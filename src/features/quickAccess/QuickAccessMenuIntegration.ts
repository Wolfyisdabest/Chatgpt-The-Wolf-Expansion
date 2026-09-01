import type {
  ChatGPTAdapter,
  ConversationMenuContext,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import { normalizeConversationIdentity } from "../../adapters/chatgpt/conversationIdentity";
import type { Logger } from "../../core/logger";
import { createWolfElement } from "../../shared/dom";
import { createIcon } from "../../shared/icons";
import type { Unsubscribe } from "../../shared/types";
import type { WolfExpansionSettings } from "../../storage/schemas";
import { getFavoriteActionLabel } from "../favorites/favoriteActionState";
import { FavoritesRepository } from "../favorites/FavoritesRepository";
import { FoldersRepository } from "../folders/FoldersRepository";
import { buildQuickAccessProjection } from "./quickAccessProjection";
import { QuickAccessMembershipService } from "./QuickAccessMembershipService";

export class QuickAccessMenuIntegration {
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly activeMenus = new Map<HTMLElement, ConversationMenuContext>();
  private settings: WolfExpansionSettings | null = null;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly favoritesRepository: FavoritesRepository,
    private readonly foldersRepository: FoldersRepository,
    private readonly membershipService: QuickAccessMembershipService,
    private readonly logger: Logger,
  ) {}

  public setSettings(settings: WolfExpansionSettings): void {
    this.settings = settings;
    void this.reconcileActiveMenus();
  }

  public enable(): void {
    if (this.unsubscribers.length > 0) {
      return;
    }
    this.unsubscribers.push(
      this.adapter.watchConversationMenus((context) => {
        this.activeMenus.set(context.menu, context);
        void this.reconcileMenu(context);
      }),
      this.favoritesRepository.subscribe(() => void this.reconcileActiveMenus()),
      this.foldersRepository.subscribe(() => void this.reconcileActiveMenus()),
    );
  }

  public disable(): void {
    while (this.unsubscribers.length > 0) {
      this.unsubscribers.pop()?.();
    }
    this.activeMenus.clear();
    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="quick-access-menu-actions"]')
      .forEach((element) => element.remove());
  }

  private async reconcileActiveMenus(): Promise<void> {
    for (const [menu, context] of this.activeMenus) {
      if (!menu.isConnected) {
        this.activeMenus.delete(menu);
        continue;
      }
      await this.reconcileMenu(context);
    }
  }

  private async reconcileMenu(context: ConversationMenuContext): Promise<void> {
    const settings = this.settings;
    if (!settings?.favorites.enabled) {
      context.menu
        .querySelector('[data-wolf-expansion="quick-access-menu-actions"]')
        ?.remove();
      return;
    }
    try {
      const [favorite, folders, memberships] = await Promise.all([
        this.favoritesRepository.isFavorite(context.conversation.conversationId),
        settings.folders.enabled ? this.foldersRepository.listFolders() : Promise.resolve([]),
        settings.folders.enabled ? this.foldersRepository.listMembership() : Promise.resolve([]),
      ]);
      if (!context.menu.isConnected) {
        return;
      }
      const membership = memberships.find(
        (item) => item.conversationId === context.conversation.conversationId,
      ) ?? null;
      const oldContainers = Array.from(
        context.menu.querySelectorAll<HTMLElement>(
          '[data-wolf-expansion="quick-access-menu-actions"]',
        ),
      );
      const matching = oldContainers.find(
        (element) => element.dataset.conversationId === context.conversation.conversationId &&
          element.dataset.menuKind === context.kind,
      );
      oldContainers.forEach((element) => {
        if (element !== matching) {
          element.remove();
        }
      });
      const container = matching ?? createWolfElement("div", "quick-access-menu-actions");
      container.className = "wolf-quick-access-menu-actions";
      container.dataset.conversationId = context.conversation.conversationId;
      container.dataset.menuKind = context.kind;
      container.replaceChildren();

      const action = this.createMenuButton(
        getFavoriteActionLabel(favorite, "menu"),
        favorite ? "star-filled" : "star-outline",
      );
      action.setAttribute("aria-pressed", String(favorite));
      action.addEventListener("click", (event) => {
        event.preventDefault();
        void this.toggleQuickAccess(context);
      });
      container.append(action);

      if (settings.folders.enabled) {
        const tree = buildQuickAccessProjection([], folders, memberships, {
          quickAccessEnabled: true,
          foldersEnabled: true,
        }).folders;
        const chooser = this.createMenuButton(
          membership ? "Move to Folder" : "Add to Folder",
          "folder",
        );
        chooser.append(createIcon("chevron-right"));
        chooser.setAttribute("aria-expanded", "false");
        const choices = createWolfElement("div", "folder-menu-choices");
        choices.className = "wolf-quick-access-menu-choices";
        choices.hidden = true;
        choices.setAttribute("role", "group");
        choices.setAttribute("aria-label", "Choose Wolf Expansion folder");
        const options = flattenFolders(tree);
        if (options.length === 0) {
          chooser.disabled = true;
          const empty = document.createElement("span");
          empty.className = "wolf-quick-access-menu-empty";
          empty.textContent = "Create a folder from Quick Access first";
          choices.append(empty);
        } else {
          for (const option of options) {
            const choice = this.createMenuButton(option.name, "folder");
            choice.className = "wolf-quick-access-menu-choice";
            choice.style.setProperty("--wolf-menu-depth", String(option.depth));
            if (membership?.folderId === option.id) {
              choice.disabled = true;
              choice.append(document.createTextNode(" (current)"));
            }
            choice.addEventListener("click", (event) => {
              event.preventDefault();
              const normalized = normalizeConversationIdentity(context.conversation);
              if (!normalized.ok) {
                this.logger.debug(`Folder menu action aborted: ${normalized.reason}.`);
                return;
              }
              void this.membershipService.assignToFolder(option.id, normalized.conversation);
            });
            choices.append(choice);
          }
        }
        chooser.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          choices.hidden = !choices.hidden;
          chooser.setAttribute("aria-expanded", String(!choices.hidden));
        });
        container.append(chooser, choices);
        if (membership) {
          const remove = this.createMenuButton("Remove from Folder", "folder");
          remove.addEventListener("click", (event) => {
            event.preventDefault();
            void this.membershipService.moveToRoot(
              context.conversation.conversationId,
            );
          });
          container.append(remove);
        }
      }

      if (!matching) {
        context.menu.append(container);
      }
    } catch (error) {
      this.logger.warn("Could not reconcile Quick Access menu actions.", error);
    }
  }

  private createMenuButton(
    label: string,
    icon: "star-outline" | "star-filled" | "folder",
  ): HTMLButtonElement {
    const button = createWolfElement("button", "quick-access-menu-action");
    button.type = "button";
    button.className = "wolf-quick-access-menu-action";
    button.setAttribute("role", "menuitem");
    button.append(createIcon(icon), document.createTextNode(label));
    return button;
  }

  private async toggleQuickAccess(context: ConversationMenuContext): Promise<void> {
    const normalized = normalizeConversationIdentity(context.conversation);
    if (!normalized.ok) {
      this.logger.debug(`Quick Access menu action aborted: ${normalized.reason}.`);
      return;
    }
    await this.membershipService.toggle(normalized.conversation);
  }
}

function flattenFolders(
  folders: ReturnType<typeof buildQuickAccessProjection>["folders"],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  return folders.flatMap((folder) => [
    { id: folder.folder.id, name: folder.folder.name, depth },
    ...flattenFolders(folder.folders, depth + 1),
  ]);
}
