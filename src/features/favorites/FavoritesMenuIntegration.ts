import type {
  ChatGPTAdapter,
  ConversationMenuContext,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import type { Logger } from "../../core/logger";
import { createWolfElement } from "../../shared/dom";
import type { Unsubscribe } from "../../shared/types";
import { normalizeConversationIdentity } from "../../adapters/chatgpt/conversationIdentity";
import { FavoritesRepository } from "./FavoritesRepository";
import { getFavoriteActionLabel } from "./favoriteActionState";

export class FavoritesMenuIntegration {
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly activeMenus = new Map<HTMLElement, ConversationMenuContext>();

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly repository: FavoritesRepository,
    private readonly logger: Logger,
  ) {}

  public enable(): void {
    if (this.unsubscribers.length > 0) {
      return;
    }

    this.unsubscribers.push(
      this.adapter.watchConversationMenus((context) => {
        this.activeMenus.set(context.menu, context);
        void this.reconcileMenu(context);
      }),
      this.repository.subscribe(() => {
        void this.reconcileActiveMenus();
      }),
    );
  }

  public disable(): void {
    while (this.unsubscribers.length > 0) {
      this.unsubscribers.pop()?.();
    }
    this.activeMenus.clear();
    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="favorite-menu-action"]')
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
    try {
      const isFavorite = await this.repository.isFavorite(context.conversation.conversationId);
      if (!context.menu.isConnected) {
        this.activeMenus.delete(context.menu);
        return;
      }

      const existingActions = Array.from(
        context.menu.querySelectorAll<HTMLButtonElement>(
          '[data-wolf-expansion="favorite-menu-action"]',
        ),
      );
      const matchingAction = existingActions.find(
        (action) =>
          action.dataset.conversationId === context.conversation.conversationId &&
          action.dataset.menuKind === context.kind,
      );
      existingActions.forEach((action) => {
        if (action !== matchingAction) {
          action.remove();
        }
      });

      if (matchingAction) {
        this.updateAction(matchingAction, isFavorite);
        return;
      }

      const action = createWolfElement("button", "favorite-menu-action");
      action.type = "button";
      action.className = "wolf-favorite-menu-action";
      action.setAttribute("role", "menuitem");
      action.dataset.conversationId = context.conversation.conversationId;
      action.dataset.menuKind = context.kind;
      this.updateAction(action, isFavorite);
      action.addEventListener("click", async (event) => {
        this.logger.debug("Wolf Favorite menu click received.", {
          kind: context.kind,
          conversationId: context.conversation.conversationId,
          url: context.conversation.url,
        });
        const identityDiagnostic = normalizeConversationIdentity(context.conversation);
        this.logger.debug("Favorite menu ConversationReference validation.", {
          kind: context.kind,
          valid: identityDiagnostic.ok,
          titleResolved: identityDiagnostic.ok
            ? identityDiagnostic.titleResolved
            : false,
          sourceHadDomLink: "link" in context.conversation,
        });
        event.preventDefault();
        try {
          const nextFavoriteState = context.kind === "sidebar-conversation"
            ? await this.executeSidebarFavoriteAction(context)
            : await this.repository.toggle(context.conversation);
          if (nextFavoriteState === null) {
            return;
          }
          if (action.isConnected) {
            this.updateAction(action, nextFavoriteState);
          }
        } catch (error) {
          this.logger.error("Could not update the favorite from the ChatGPT menu.", error);
        }
      });
      context.menu.append(action);
      this.logger.debug("Favorite menu action injected.", {
        kind: context.kind,
        conversationId: context.conversation.conversationId,
      });
    } catch (error) {
      this.logger.warn("Could not add the Favorites action to a ChatGPT menu.", error);
    }
  }

  private updateAction(action: HTMLButtonElement, isFavorite: boolean): void {
    action.textContent = getFavoriteActionLabel(isFavorite, "menu");
    action.setAttribute("aria-pressed", String(isFavorite));
  }

  private async executeSidebarFavoriteAction(
    context: ConversationMenuContext,
  ): Promise<boolean | null> {
    this.logger.debug("Sidebar menu Favorite clicked.");
    const normalized = normalizeConversationIdentity(context.conversation);
    if (!normalized.ok) {
      this.logger.debug(`Sidebar menu Favorite aborted: ${normalized.reason}.`);
      return null;
    }

    const { conversation } = normalized;
    const currentlyFavorite = await this.repository.isFavorite(conversation.conversationId);
    const operation = currentlyFavorite ? "remove" : "add";
    this.logger.debug(`target=${conversation.conversationId}`);
    this.logger.debug(`operation=${operation}`);
    this.logger.debug("Sidebar menu repository operation started.", {
      operation,
      titleResolved: normalized.titleResolved,
      url: conversation.url,
    });

    if (currentlyFavorite) {
      await this.repository.remove(conversation.conversationId);
    } else {
      await this.repository.add(conversation);
    }

    this.logger.debug("Sidebar menu repository operation completed.", {
      operation,
      conversationId: conversation.conversationId,
    });
    return !currentlyFavorite;
  }
}
