import type {
  ChatGPTAdapter,
  ConversationReference,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import type { Logger } from "../../core/logger";
import { createWolfElement } from "../../shared/dom";
import type { FavoriteConversation, WolfExpansionSettings } from "../../storage/schemas";
import { getFavoriteActionLabel } from "./favoriteActionState";
import { createFavoriteListView } from "./favoritesViewModel";

interface FavoritesSidebarCallbacks {
  onCollapseChange(collapsed: boolean): Promise<void>;
  onRemove(conversationId: string): Promise<void>;
  onReorder(conversationIds: string[]): Promise<void>;
  onSidebarFavoriteAction(conversation: ConversationReference): Promise<boolean | null>;
  onDebugToggleCurrentConversation(): Promise<void>;
}

export class FavoritesSidebar {
  private section: HTMLElement | null = null;
  private draggedConversationId: string | null = null;
  private actionRoot: HTMLElement | null = null;

  private readonly handleActionClick = (event: MouseEvent): void => {
    const action = this.findRowAction(event);
    if (!action) {
      return;
    }

    this.logger.debug("Wolf Favorite click received.");
    this.consumeFavoriteClick(event);
    this.logger.debug("Wolf Favorite action element identified.");
    void this.activateConversationAction(action);
  };

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly callbacks: FavoritesSidebarCallbacks,
    private readonly logger: Logger,
  ) {}

  public render(
    favorites: readonly FavoriteConversation[],
    settings: WolfExpansionSettings,
    collapsed: boolean,
  ): void {
    const section = this.ensureMounted();
    if (!section) {
      return;
    }

    section.replaceChildren();
    const header = createWolfElement("button", "favorites-toggle");
    header.type = "button";
    header.className = "wolf-favorites-header";
    header.setAttribute("aria-expanded", String(!collapsed));
    header.setAttribute("aria-controls", "wolf-expansion-favorites-list");
    header.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} Favorites`);

    const chevron = document.createElement("span");
    chevron.className = "wolf-favorites-chevron";
    chevron.textContent = collapsed ? "›" : "⌄";
    chevron.setAttribute("aria-hidden", "true");

    const heading = document.createElement("span");
    heading.className = "wolf-favorites-heading";
    heading.textContent = `${settings.favorites.showIcon ? "★ " : ""}Favorites`;

    const count = document.createElement("span");
    count.className = "wolf-favorites-count";
    count.textContent = String(favorites.length);
    count.setAttribute("aria-label", `${favorites.length} favorite conversations`);

    header.append(chevron, heading, count);
    header.addEventListener("click", () => {
      void this.runSafely(() => this.callbacks.onCollapseChange(!collapsed));
    });
    section.append(header);

    if (settings.debug.enabled) {
      const currentConversationId = this.adapter.getCurrentConversationId();
      const currentConversationIsFavorite = currentConversationId
        ? favorites.some((favorite) => favorite.conversationId === currentConversationId)
        : false;
      const debugButton = createWolfElement("button", "debug-favorite-current");
      debugButton.type = "button";
      debugButton.className = "wolf-debug-favorite-current";
      debugButton.textContent = getFavoriteActionLabel(
        currentConversationIsFavorite,
        "debug-current",
      );
      debugButton.disabled = currentConversationId === null;
      debugButton.title = currentConversationId
        ? debugButton.textContent
        : "Open a saved conversation to test Favorites";
      debugButton.addEventListener("click", (event) => {
        this.consumeEvent(event);
        this.logger.debug("Debug current-chat Favorite toggle triggered.");
        void this.runSafely(() => this.callbacks.onDebugToggleCurrentConversation());
      });
      section.append(debugButton);
    }

    const list = createWolfElement("ul", "favorites-list");
    list.id = "wolf-expansion-favorites-list";
    list.className = "wolf-favorites-list";
    list.hidden = collapsed;
    list.setAttribute("aria-label", "Favorite conversations");

    const favoriteItems = createFavoriteListView(favorites);
    if (favoriteItems.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "wolf-favorites-empty";
      emptyItem.textContent = "No favorites yet";
      list.append(emptyItem);
    } else {
      favoriteItems.forEach((favorite, index) => {
        list.append(this.createFavoriteItem(favorite, index, favoriteItems.length));
      });
    }

    section.append(list);
  }

  public syncConversationButtons(
    conversations: readonly ConversationReference[],
    favoriteIds: ReadonlySet<string>,
  ): void {
    this.bindActionRoot();
    this.removeLegacyConversationButtons();
    this.actionRoot
      ?.querySelectorAll<HTMLElement>('[data-wolf-expansion-row-host="favorite"]')
      .forEach((row) => row.removeAttribute("data-wolf-expansion-row-host"));
    const retainedContainers = new Set<HTMLElement>();

    for (const conversation of conversations) {
      const target = this.adapter.findConversationActionInsertionTarget(conversation.link);
      const existingContainer = target
        ? Array.from(
            target.row.querySelectorAll<HTMLElement>(
              '[data-wolf-expansion="row-favorite-action"]',
            ),
          ).find(
            (element) => element.dataset.conversationId === conversation.conversationId,
          )
        : null;

      if (!target) {
        continue;
      }

      const container = existingContainer ?? createWolfElement("span", "row-favorite-action");
      retainedContainers.add(container);
      container.className = "wolf-row-actions";
      container.dataset.conversationId = conversation.conversationId;
      container.dataset.insertionStrategy = target.strategy;
      const existingButton = container.querySelector<HTMLButtonElement>(
        '[data-wolf-expansion="favorite-row-action"]',
      );
      const button = existingButton ?? createWolfElement("button", "favorite-row-action");

      button.type = "button";
      button.className = "wolf-favorite-row-button";
      button.dataset.conversationId = conversation.conversationId;
      button.dataset.wolfExpansionAction = "toggle-favorite-v4";
      this.updateFavoriteButton(button, favoriteIds.has(conversation.conversationId), conversation.title);

      if (!existingButton) {
        container.append(button);
      }
      if (container.parentElement !== target.parent || container.nextElementSibling !== target.before) {
        target.parent.insertBefore(container, target.before);
      }
      target.row.dataset.wolfExpansionRowHost = "favorite";
      this.logger.debug("Row star inserted.", {
        conversationId: conversation.conversationId,
        strategy: target.strategy,
      });
    }

    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="row-favorite-action"]')
      .forEach((container) => {
        if (!retainedContainers.has(container)) {
          container.remove();
        }
      });
  }

  public remove(): void {
    this.section?.remove();
    this.section = null;
    this.unbindActionRoot();
    document
      .querySelectorAll<HTMLElement>(
        '[data-wolf-expansion="row-actions"], [data-wolf-expansion="row-favorite-action"], [data-wolf-expansion="favorite-row-action"]',
      )
      .forEach((element) => element.remove());
    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion-row-host="favorite"]')
      .forEach((row) => row.removeAttribute("data-wolf-expansion-row-host"));
    this.adapter.cleanupConversationActionHosts();
  }

  private ensureMounted(): HTMLElement | null {
    const target = this.adapter.findSidebarInsertionTarget();
    if (!target) {
      return null;
    }

    if (!this.section) {
      this.section = createWolfElement("section", "favorites-section");
      this.section.className = "wolf-favorites-section";
      this.section.setAttribute("aria-label", "Wolf Expansion Favorites");
    }

    if (
      this.section.parentElement !== target.parent ||
      (target.before !== this.section && this.section.nextElementSibling !== target.before)
    ) {
      target.parent.insertBefore(this.section, target.before);
    }

    return this.section;
  }

  private createFavoriteItem(
    favorite: Pick<FavoriteConversation, "conversationId" | "title" | "url">,
    index: number,
    total: number,
  ): HTMLLIElement {
    const item = createWolfElement("li", "favorite-item");
    item.className = "wolf-favorite-item";
    item.draggable = true;
    item.dataset.conversationId = favorite.conversationId;

    const link = createWolfElement("a", "favorite-link");
    link.className = "wolf-favorite-link";
    link.href = favorite.url;
    link.textContent = favorite.title;
    link.title = favorite.title;

    const controls = document.createElement("span");
    controls.className = "wolf-favorite-controls";
    controls.append(
      this.createMoveButton(favorite, "up", index === 0),
      this.createMoveButton(favorite, "down", index === total - 1),
    );

    const removeButton = createWolfElement("button", "favorite-remove");
    removeButton.type = "button";
    removeButton.className = "wolf-favorite-control";
    removeButton.textContent = "×";
    removeButton.title = `Remove ${favorite.title} from Favorites`;
    removeButton.setAttribute("aria-label", removeButton.title);
    removeButton.addEventListener("click", (event) => {
      this.consumeEvent(event);
      void this.runSafely(() => this.callbacks.onRemove(favorite.conversationId));
    });
    controls.append(removeButton);
    item.append(link, controls);

    item.addEventListener("dragstart", (event) => {
      this.draggedConversationId = favorite.conversationId;
      item.classList.add("wolf-is-dragging");
      event.dataTransfer?.setData("text/plain", favorite.conversationId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
    });
    item.addEventListener("dragover", (event) => {
      if (this.draggedConversationId && this.draggedConversationId !== favorite.conversationId) {
        event.preventDefault();
        item.classList.add("wolf-is-drop-target");
      }
    });
    item.addEventListener("dragleave", () => item.classList.remove("wolf-is-drop-target"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("wolf-is-drop-target");
      const draggedId = this.draggedConversationId ?? event.dataTransfer?.getData("text/plain");
      if (draggedId && draggedId !== favorite.conversationId) {
        void this.runSafely(() => this.moveBefore(draggedId, favorite.conversationId));
      }
    });
    item.addEventListener("dragend", () => {
      this.draggedConversationId = null;
      item.classList.remove("wolf-is-dragging");
      this.section?.querySelectorAll(".wolf-is-drop-target").forEach((element) => {
        element.classList.remove("wolf-is-drop-target");
      });
    });

    return item;
  }

  private createMoveButton(
    favorite: Pick<FavoriteConversation, "conversationId" | "title">,
    direction: "up" | "down",
    disabled: boolean,
  ): HTMLButtonElement {
    const button = createWolfElement("button", `favorite-move-${direction}`);
    button.type = "button";
    button.className = "wolf-favorite-control";
    button.textContent = direction === "up" ? "↑" : "↓";
    button.disabled = disabled;
    button.title = `Move ${favorite.title} ${direction}`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", (event) => {
      this.consumeEvent(event);
      void this.runSafely(() => this.moveByOne(favorite.conversationId, direction));
    });
    button.addEventListener("keydown", (event) => {
      const matchingArrow =
        (direction === "up" && event.key === "ArrowUp") ||
        (direction === "down" && event.key === "ArrowDown");
      if (matchingArrow) {
        this.consumeEvent(event);
        void this.runSafely(() => this.moveByOne(favorite.conversationId, direction));
      }
    });
    return button;
  }

  private async moveBefore(draggedId: string, targetId: string): Promise<void> {
    const ids = this.getRenderedConversationIds().filter((id) => id !== draggedId);
    const targetIndex = ids.indexOf(targetId);
    if (targetIndex < 0) {
      return;
    }
    ids.splice(targetIndex, 0, draggedId);
    await this.callbacks.onReorder(ids);
  }

  private async moveByOne(conversationId: string, direction: "up" | "down"): Promise<void> {
    const ids = this.getRenderedConversationIds();
    const currentIndex = ids.indexOf(conversationId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) {
      return;
    }

    [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex]!, ids[currentIndex]!];
    await this.callbacks.onReorder(ids);
  }

  private getRenderedConversationIds(): string[] {
    if (!this.section) {
      return [];
    }

    return Array.from(
      this.section.querySelectorAll<HTMLElement>('[data-wolf-expansion="favorite-item"]'),
    )
      .map((item) => item.dataset.conversationId)
      .filter((id): id is string => typeof id === "string");
  }

  private updateFavoriteButton(
    button: HTMLButtonElement,
    isFavorite: boolean,
    title: string,
  ): void {
    button.textContent = isFavorite ? "★" : "☆";
    button.classList.toggle("wolf-is-favorite", isFavorite);
    button.title = `${isFavorite ? "Remove" : "Add"} ${title} ${isFavorite ? "from" : "to"} Favorites`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(isFavorite));
  }

  private bindActionRoot(): void {
    const sidebar = this.adapter.findSidebar();
    if (sidebar === this.actionRoot) {
      return;
    }

    this.unbindActionRoot();
    this.actionRoot = sidebar;
    this.actionRoot?.addEventListener("click", this.handleActionClick, true);
    if (this.actionRoot) {
      this.logger.debug("Favorite row-action delegation bound to the sidebar.");
    }
  }

  private unbindActionRoot(): void {
    this.actionRoot?.removeEventListener("click", this.handleActionClick, true);
    this.actionRoot = null;
  }

  private removeLegacyConversationButtons(): void {
    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="favorite-row-action"]')
      .forEach((element) => {
        if (!element.closest('[data-wolf-expansion="row-favorite-action"]')) {
          element.remove();
        }
      });
    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="row-actions"]')
      .forEach((container) => container.remove());
    this.adapter.cleanupConversationActionHosts();
  }

  private findRowAction(event: Event): HTMLButtonElement | null {
    const target = event.target;
    if (!(target instanceof Element) || !this.actionRoot) {
      return null;
    }

    const action = target.closest<HTMLButtonElement>(
      '[data-wolf-expansion="favorite-row-action"][data-wolf-expansion-action="toggle-favorite-v4"]',
    );
    if (!action) {
      return null;
    }
    if (!this.actionRoot.contains(action)) {
      this.logger.debug("Favorite aborted: action is outside the delegated sidebar root.");
      return null;
    }
    return action;
  }

  private async activateConversationAction(action: HTMLButtonElement): Promise<void> {
    this.logger.debug("Sidebar Favorite action.");
    const conversation = this.adapter.resolveConversationFromActionElement(action);
    if (!conversation) {
      this.logger.debug("Sidebar Favorite aborted: owning conversation could not be resolved.");
      return;
    }

    try {
      const isFavorite = await this.callbacks.onSidebarFavoriteAction(conversation);
      if (isFavorite === null) {
        return;
      }
      this.updateVisibleFavoriteIndicators(conversation.conversationId, isFavorite);
    } catch (error) {
      this.logger.error("The Favorite row action failed.", error);
    }
  }

  private updateVisibleFavoriteIndicators(conversationId: string, isFavorite: boolean): void {
    this.actionRoot
      ?.querySelectorAll<HTMLButtonElement>('[data-wolf-expansion="favorite-row-action"]')
      .forEach((button) => {
        if (button.dataset.conversationId === conversationId) {
          const title = button.getAttribute("aria-label")
            ?.replace(/^(?:Add|Remove) /u, "")
            .replace(/ (?:to|from) Favorites$/u, "") ?? "conversation";
          this.updateFavoriteButton(button, isFavorite, title);
        }
      });
  }

  private consumeEvent(event: Event): void {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private consumeFavoriteClick(event: MouseEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  private async runSafely(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error("A Favorites sidebar action failed.", error);
    }
  }
}
