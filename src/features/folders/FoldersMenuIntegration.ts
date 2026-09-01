import type {
  ChatGPTAdapter,
  ConversationMenuContext,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import type { Logger } from "../../core/logger";
import { createWolfElement } from "../../shared/dom";
import type { Unsubscribe } from "../../shared/types";
import type { FolderTreeNode } from "./FoldersRepository";
import { FoldersRepository } from "./FoldersRepository";

export class FoldersMenuIntegration {
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly activeMenus = new Map<HTMLElement, ConversationMenuContext>();

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly repository: FoldersRepository,
    private readonly logger: Logger,
  ) {}

  public enable(): void {
    if (this.unsubscribers.length > 0) {
      return;
    }
    this.unsubscribers.push(
      this.adapter.watchConversationMenus((context) => {
        this.activeMenus.set(context.menu, context);
        this.logger.debug("Folder menu target resolved.", {
          kind: context.kind,
          conversationId: context.conversation.conversationId,
        });
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
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="folder-menu-actions"]')
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
      const [tree, membership] = await Promise.all([
        this.repository.getTree(),
        this.repository.getMembership(context.conversation.conversationId),
      ]);
      if (!context.menu.isConnected) {
        this.activeMenus.delete(context.menu);
        return;
      }
      const existing = Array.from(
        context.menu.querySelectorAll<HTMLElement>('[data-wolf-expansion="folder-menu-actions"]'),
      );
      const matching = existing.find(
        (element) => element.dataset.conversationId === context.conversation.conversationId &&
          element.dataset.menuKind === context.kind,
      );
      existing.forEach((element) => {
        if (element !== matching) {
          element.remove();
        }
      });
      const container = matching ?? createWolfElement("div", "folder-menu-actions");
      container.className = "wolf-folder-menu-actions";
      container.dataset.conversationId = context.conversation.conversationId;
      container.dataset.menuKind = context.kind;
      container.replaceChildren();

      const chooser = createWolfElement("button", "folder-menu-chooser");
      chooser.type = "button";
      chooser.className = "wolf-folder-menu-action";
      chooser.setAttribute("role", "menuitem");
      chooser.setAttribute("aria-expanded", "false");
      chooser.textContent = `${membership ? "Move to Folder" : "Add to Folder"} ›`;
      const choices = createWolfElement("div", "folder-menu-choices");
      choices.className = "wolf-folder-menu-choices";
      choices.hidden = true;
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-label", "Choose Wolf Expansion folder");

      const flattened = flattenTree(tree);
      if (flattened.length === 0) {
        const empty = document.createElement("span");
        empty.className = "wolf-folder-menu-empty";
        empty.textContent = "Create a folder from the Folders section first";
        choices.append(empty);
        chooser.disabled = true;
      } else {
        for (const option of flattened) {
          const button = createWolfElement("button", "folder-menu-choice");
          button.type = "button";
          button.className = "wolf-folder-menu-choice";
          button.dataset.folderId = option.id;
          button.style.setProperty("--wolf-folder-menu-depth", String(option.depth));
          button.textContent = `📁 ${option.name}`;
          button.setAttribute("aria-label", `${membership ? "Move" : "Add"} conversation to ${option.name}`);
          if (membership?.folderId === option.id) {
            button.disabled = true;
            button.textContent += " (current)";
          }
          button.addEventListener("click", (event) => {
            event.preventDefault();
            void this.assign(context, option.id);
          });
          choices.append(button);
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
        const remove = createWolfElement("button", "folder-menu-remove");
        remove.type = "button";
        remove.className = "wolf-folder-menu-action";
        remove.setAttribute("role", "menuitem");
        remove.textContent = "Remove from Folder";
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          void this.remove(context);
        });
        container.append(remove);
      }
      if (!matching) {
        context.menu.append(container);
      }
      this.logger.debug("Folder menu actions injected.", {
        kind: context.kind,
        conversationId: context.conversation.conversationId,
      });
    } catch (error) {
      this.logger.warn("Could not add Folders actions to a ChatGPT menu.", error);
    }
  }

  private async assign(
    context: ConversationMenuContext,
    folderId: string,
  ): Promise<void> {
    try {
      await this.repository.assignConversation(folderId, context.conversation);
    } catch (error) {
      this.logger.error("Could not assign the conversation to a folder.", error);
    }
  }

  private async remove(
    context: ConversationMenuContext,
  ): Promise<void> {
    try {
      await this.repository.removeConversation(context.conversation.conversationId);
    } catch (error) {
      this.logger.error("Could not remove the conversation from its folder.", error);
    }
  }
}

function flattenTree(
  tree: readonly FolderTreeNode[],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  return tree.flatMap((node) => [
    { id: node.folder.id, name: node.folder.name, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}
