import type {
  ChatGPTAdapter,
  ConversationIdentity,
  ConversationMenuContext,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import { normalizeConversationIdentity } from "../../adapters/chatgpt/conversationIdentity";
import type { NativeConversationMenuActionDescriptor } from "../../adapters/chatgpt/nativeConversationActions";
import type { Logger } from "../../core/logger";
import { createWolfElement } from "../../shared/dom";
import { createIcon } from "../../shared/icons";
import type { Unsubscribe } from "../../shared/types";
import type { WolfExpansionSettings } from "../../storage/schemas";
import { getFavoriteActionLabel } from "../favorites/favoriteActionState";
import { FavoritesRepository } from "../favorites/FavoritesRepository";
import { FoldersRepository } from "../folders/FoldersRepository";
import {
  getAnchoredMenuPosition,
  LocalConversationMenuController,
} from "./localConversationMenu";
import { FreshNativeActionRequestController } from "./freshNativeAction";
import { NativeRenameDraftController } from "./nativeRenameDraft";
import { buildQuickAccessProjection } from "./quickAccessProjection";
import { QuickAccessMembershipService } from "./QuickAccessMembershipService";

interface QuickAccessMenuCallbacks {
  onNativeRenameDraft(conversationId: string, draft: string): void;
  onNativeRenameFinished(conversationId: string): Promise<void>;
}

export class QuickAccessMenuIntegration {
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly activeMenus = new Map<HTMLElement, ConversationMenuContext>();
  private readonly trackedNativeMenus = new WeakSet<HTMLElement>();
  private readonly processedProxyMenus = new WeakSet<HTMLElement>();
  private readonly localMenuState = new LocalConversationMenuController();
  private readonly freshNativeAction = new FreshNativeActionRequestController();
  private readonly renameDraft = new NativeRenameDraftController();
  private settings: WolfExpansionSettings | null = null;
  private localMenu: HTMLElement | null = null;
  private localMenuAnchor: HTMLElement | null = null;
  private localConversation: ConversationIdentity | null = null;
  private localNativeActions: NativeConversationMenuActionDescriptor[] = [];
  private localMenuAvailabilityTimeout: number | null = null;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly favoritesRepository: FavoritesRepository,
    private readonly foldersRepository: FoldersRepository,
    private readonly membershipService: QuickAccessMembershipService,
    private readonly callbacks: QuickAccessMenuCallbacks,
    private readonly logger: Logger,
  ) {}

  public setSettings(settings: WolfExpansionSettings): void {
    this.settings = settings;
    void this.reconcileActiveMenus();
    if (this.localMenu) {
      void this.renderLocalMenu();
    }
  }

  public enable(): void {
    if (this.unsubscribers.length > 0) {
      return;
    }
    this.unsubscribers.push(
      this.adapter.watchConversationMenus((context) => {
        const pendingAction = this.freshNativeAction.activeState;
        if (
          pendingAction &&
          context.kind === "sidebar-conversation" &&
          context.conversation.conversationId === pendingAction.conversationId
        ) {
          this.invokeFreshNativeAction(context);
          return;
        }
        this.trackNativeRenameAction(context);
        const localState = this.localMenuState.activeState;
        if (
          localState &&
          context.kind === "sidebar-conversation" &&
          context.conversation.conversationId === localState.conversationId
        ) {
          this.receiveProxiedNativeMenu(context, localState.requestId);
          return;
        }
        this.activeMenus.set(context.menu, context);
        void this.reconcileMenu(context);
      }),
      this.favoritesRepository.subscribe(() => {
        void this.reconcileActiveMenus();
        if (this.localMenu) {
          void this.renderLocalMenu();
        }
      }),
      this.foldersRepository.subscribe(() => {
        void this.reconcileActiveMenus();
        if (this.localMenu) {
          void this.renderLocalMenu();
        }
      }),
    );
    document.addEventListener("pointerdown", this.handleOutsidePointer, true);
    document.addEventListener("keydown", this.handleDocumentKeydown, true);
    document.addEventListener("input", this.handleNativeRenameInput, true);
    document.addEventListener("focusout", this.handleNativeRenameFocusOut, true);
  }

  public disable(): void {
    while (this.unsubscribers.length > 0) {
      this.unsubscribers.pop()?.();
    }
    document.removeEventListener("pointerdown", this.handleOutsidePointer, true);
    document.removeEventListener("keydown", this.handleDocumentKeydown, true);
    document.removeEventListener("input", this.handleNativeRenameInput, true);
    document.removeEventListener("focusout", this.handleNativeRenameFocusOut, true);
    this.closeLocalMenu();
    this.freshNativeAction.clear();
    const rename = this.renameDraft.activeState;
    if (rename) {
      this.adapter.finishNativeRenameTracking(rename.conversationId);
    }
    this.renameDraft.clear();
    this.activeMenus.clear();
    document
      .querySelectorAll<HTMLElement>('[data-wolf-expansion="quick-access-menu-actions"]')
      .forEach((element) => element.remove());
  }

  public openLocalMenu(conversation: ConversationIdentity, anchor: HTMLElement): void {
    const normalized = normalizeConversationIdentity(conversation);
    if (!normalized.ok) {
      this.logger.debug(`Local Quick Access menu aborted: ${normalized.reason}.`);
      return;
    }
    this.closeLocalMenu();
    const state = this.localMenuState.open(normalized.conversation.conversationId);
    this.localConversation = normalized.conversation;
    this.localMenuAnchor = anchor;
    this.mountLocalMenu(state.requestId);
    void this.renderLocalMenu();

    const result = this.adapter.openNativeConversationActions(normalized.conversation.conversationId);
    if (result.status === "unavailable") {
      this.localMenuState.setNativeAvailability(state.requestId, "unavailable");
      void this.renderLocalMenu();
      return;
    }
    this.localMenuAvailabilityTimeout = window.setTimeout(() => {
      this.localMenuAvailabilityTimeout = null;
      if (this.localMenuState.setNativeAvailability(state.requestId, "unavailable")) {
        void this.renderLocalMenu();
      }
    }, 750);
  }

  private receiveProxiedNativeMenu(context: ConversationMenuContext, requestId: number): void {
    if (this.processedProxyMenus.has(context.menu)) {
      return;
    }
    this.processedProxyMenus.add(context.menu);
    this.adapter.hideNativeConversationMenuForProxy(context.menu);
    this.localNativeActions = this.adapter.listNativeConversationMenuActions(context.menu);
    this.adapter.closeNativeConversationMenu(context.menu);
    this.clearLocalAvailabilityTimeout();
    this.localMenuState.setNativeAvailability(
      requestId,
      this.localNativeActions.length > 0 ? "available" : "unavailable",
    );
    void this.renderLocalMenu();
    this.logger.debug("Native ChatGPT actions prepared for the local Quick Access menu.", {
      conversationId: context.conversation.conversationId,
      actionCount: this.localNativeActions.length,
    });
  }

  private mountLocalMenu(requestId: number): void {
    const menu = createWolfElement("div", "quick-access-local-menu");
    menu.className = "wolf-quick-access-local-menu";
    menu.dataset.requestId = String(requestId);
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Conversation actions");
    menu.tabIndex = -1;
    document.body.append(menu);
    this.localMenu = menu;
    this.positionLocalMenu();
    queueMicrotask(() => menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({
      preventScroll: true,
    }));
  }

  private async renderLocalMenu(): Promise<void> {
    const menu = this.localMenu;
    const state = this.localMenuState.activeState;
    const conversation = this.localConversation;
    const settings = this.settings;
    if (!menu || !state || !conversation || !settings ||
      menu.dataset.requestId !== String(state.requestId)) {
      return;
    }
    const [favorite, folders, memberships] = await Promise.all([
      this.favoritesRepository.isFavorite(conversation.conversationId),
      settings.folders.enabled ? this.foldersRepository.listFolders() : Promise.resolve([]),
      settings.folders.enabled ? this.foldersRepository.listMembership() : Promise.resolve([]),
    ]);
    if (this.localMenuState.activeState?.requestId !== state.requestId || !menu.isConnected) {
      return;
    }
    const membership = memberships.find(
      (item) => item.conversationId === conversation.conversationId,
    ) ?? null;
    const fragment = document.createDocumentFragment();
    const nativeRegion = createWolfElement("div", "quick-access-local-native-actions");
    nativeRegion.className = "wolf-quick-access-local-menu-region";
    if (state.nativeAvailability === "available") {
      for (const action of this.localNativeActions) {
        nativeRegion.append(this.createNativeProxyButton(action, conversation));
      }
    } else {
      const status = document.createElement("p");
      status.className = "wolf-quick-access-local-menu-status";
      status.textContent = state.nativeAvailability === "loading"
        ? "Loading ChatGPT actions…"
        : "ChatGPT actions unavailable right now";
      status.setAttribute("role", "status");
      nativeRegion.append(status);
    }
    fragment.append(nativeRegion);

    const wolfRegion = createWolfElement("div", "quick-access-local-wolf-actions");
    wolfRegion.className = "wolf-quick-access-local-menu-region wolf-is-wolf-actions";
    if (settings.folders.enabled) {
      const tree = buildQuickAccessProjection([], folders, memberships, {
        quickAccessEnabled: true,
        foldersEnabled: true,
      }).folders;
      const choices = flattenFolders(tree);
      const chooser = this.createLocalMenuButton(
        membership ? "Move to Folder" : "Add to Folder",
        "folder",
      );
      chooser.setAttribute("aria-haspopup", "true");
      chooser.setAttribute("aria-expanded", "false");
      const folderChoices = createWolfElement("div", "quick-access-local-folder-choices");
      folderChoices.className = "wolf-quick-access-local-folder-choices";
      folderChoices.hidden = true;
      if (choices.length === 0) {
        chooser.disabled = true;
      } else {
        for (const choice of choices) {
          const button = this.createLocalMenuButton(choice.name, "folder");
          button.classList.add("wolf-quick-access-local-folder-choice");
          button.style.setProperty("--wolf-menu-depth", String(choice.depth));
          button.disabled = membership?.folderId === choice.id;
          button.addEventListener("click", () => {
            void this.membershipService.assignToFolder(choice.id, conversation);
            this.closeLocalMenu();
          });
          folderChoices.append(button);
        }
      }
      chooser.addEventListener("click", (event) => {
        event.stopPropagation();
        folderChoices.hidden = !folderChoices.hidden;
        chooser.setAttribute("aria-expanded", String(!folderChoices.hidden));
        this.positionLocalMenu();
      });
      wolfRegion.append(chooser, folderChoices);
      if (membership) {
        const root = this.createLocalMenuButton("Move to Quick Access root", "tray");
        root.addEventListener("click", () => {
          void this.membershipService.moveToRoot(conversation.conversationId);
          this.closeLocalMenu();
        });
        wolfRegion.append(root);
      }
    }
    const membershipAction = this.createLocalMenuButton(
      getFavoriteActionLabel(favorite, "menu"),
      favorite ? "star-filled" : "star-outline",
    );
    membershipAction.setAttribute("aria-pressed", String(favorite));
    membershipAction.addEventListener("click", () => {
      void this.membershipService.toggle(conversation);
      this.closeLocalMenu();
    });
    wolfRegion.append(membershipAction);
    fragment.append(wolfRegion);
    menu.replaceChildren(fragment);
    this.positionLocalMenu();
    if (!menu.contains(document.activeElement)) {
      queueMicrotask(() => menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({
        preventScroll: true,
      }));
    }
  }

  private createNativeProxyButton(
    action: NativeConversationMenuActionDescriptor,
    conversation: ConversationIdentity,
  ): HTMLButtonElement {
    const button = this.createLocalMenuButton(action.label);
    button.disabled = action.disabled;
    button.dataset.nativeActionKind = action.kind;
    button.addEventListener("click", () => {
      this.requestFreshNativeAction(conversation.conversationId, action.kind);
    });
    return button;
  }

  private requestFreshNativeAction(
    conversationId: string,
    kind: NativeConversationMenuActionDescriptor["kind"],
  ): void {
    if ((kind === "pin" || kind === "unpin") &&
      this.adapter.activateNativeConversationPinAction(conversationId, kind)) {
      this.logger.debug("Fresh native Pin action activated.", { conversationId, kind });
      this.closeLocalMenu();
      return;
    }

    const request = this.freshNativeAction.begin(conversationId, kind);
    this.clearLocalAvailabilityTimeout();
    const result = this.adapter.openNativeConversationActions(conversationId);
    if (result.status === "unavailable") {
      this.freshNativeAction.clear(request.requestId);
      this.showNativeActionUnavailable();
      return;
    }
    this.localMenuAvailabilityTimeout = window.setTimeout(() => {
      this.localMenuAvailabilityTimeout = null;
      if (this.freshNativeAction.clear(request.requestId)) {
        this.showNativeActionUnavailable();
      }
    }, 1_000);
  }

  private invokeFreshNativeAction(context: ConversationMenuContext): void {
    const request = this.freshNativeAction.consumeForConversation(
      context.conversation.conversationId,
    );
    if (!request) {
      return;
    }
    this.clearLocalAvailabilityTimeout();
    this.processedProxyMenus.add(context.menu);
    this.adapter.hideNativeConversationMenuForProxy(context.menu);
    if (request.kind === "rename") {
      this.beginNativeRename(request.conversationId);
    }
    const activated = this.adapter.activateNativeConversationMenuAction(
      context.menu,
      request.kind,
    );
    if (!activated) {
      if (request.kind === "rename") {
        this.finishNativeRename(request.conversationId);
      }
      this.adapter.closeNativeConversationMenu(context.menu);
      this.showNativeActionUnavailable();
      return;
    }
    this.logger.debug("Fresh connected native conversation action activated.", {
      conversationId: request.conversationId,
      kind: request.kind,
    });
    this.closeLocalMenu(false);
  }

  private showNativeActionUnavailable(): void {
    const menu = this.localMenu;
    if (!menu) {
      return;
    }
    let status = menu.querySelector<HTMLElement>(
      '[data-wolf-expansion="quick-access-local-menu-status"]',
    );
    if (!status) {
      status = createWolfElement("p", "quick-access-local-menu-status");
      status.className = "wolf-quick-access-local-menu-status";
      status.setAttribute("role", "status");
      menu.prepend(status);
    }
    status.textContent = "ChatGPT action unavailable right now";
  }

  private createLocalMenuButton(
    label: string,
    icon?: Parameters<typeof createIcon>[0],
  ): HTMLButtonElement {
    const button = createWolfElement("button", "quick-access-local-menu-action");
    button.type = "button";
    button.className = "wolf-quick-access-local-menu-action";
    button.setAttribute("role", "menuitem");
    if (icon) {
      button.append(createIcon(icon));
    }
    button.append(document.createTextNode(label));
    return button;
  }

  private positionLocalMenu(): void {
    const menu = this.localMenu;
    const anchor = this.localMenuAnchor;
    if (!menu || !anchor?.isConnected) {
      return;
    }
    const position = getAnchoredMenuPosition(
      anchor.getBoundingClientRect(),
      menu.getBoundingClientRect(),
      { height: window.innerHeight, width: window.innerWidth },
    );
    menu.style.left = `${position.left}px`;
    menu.style.top = `${position.top}px`;
  }

  private closeLocalMenu(closeNative = true): void {
    this.clearLocalAvailabilityTimeout();
    this.localMenuState.close();
    this.localMenu?.remove();
    this.localMenu = null;
    this.localMenuAnchor = null;
    this.localConversation = null;
    this.localNativeActions = [];
    if (closeNative) {
      this.freshNativeAction.clear();
    }
  }

  private clearLocalAvailabilityTimeout(): void {
    if (this.localMenuAvailabilityTimeout !== null) {
      window.clearTimeout(this.localMenuAvailabilityTimeout);
      this.localMenuAvailabilityTimeout = null;
    }
  }

  private readonly handleOutsidePointer = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node) || this.localMenu?.contains(target) ||
      this.localMenuAnchor?.contains(target)) {
      return;
    }
    this.closeLocalMenu();
  };

  private readonly handleDocumentKeydown = (event: KeyboardEvent): void => {
    const rename = this.renameDraft.activeState;
    if (rename && event.target instanceof Element &&
      this.adapter.isNativeConversationRenameEditor(event.target, rename.conversationId)) {
      if (event.key === "Enter" || event.key === "Escape") {
        queueMicrotask(() => this.finishNativeRename(rename.conversationId));
      }
      return;
    }
    if (!this.localMenu) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const anchor = this.localMenuAnchor;
      this.closeLocalMenu();
      anchor?.focus({ preventScroll: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    const actions = Array.from(
      this.localMenu.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([hidden])'),
    ).filter((button) => button.offsetParent !== null);
    if (actions.length === 0) {
      return;
    }
    event.preventDefault();
    const current = actions.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? actions.length - 1
        : event.key === "ArrowDown"
          ? (current + 1 + actions.length) % actions.length
          : (current - 1 + actions.length) % actions.length;
    actions[next]?.focus({ preventScroll: true });
  };

  private trackNativeRenameAction(context: ConversationMenuContext): void {
    if (this.trackedNativeMenus.has(context.menu)) {
      return;
    }
    this.trackedNativeMenus.add(context.menu);
    context.menu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-wolf-expansion]')) {
        return;
      }
      if (this.adapter.getNativeConversationMenuActionKind(context.menu, target) === "rename") {
        this.beginNativeRename(context.conversation.conversationId);
      }
    }, true);
  }

  private beginNativeRename(conversationId: string): void {
    if (!this.adapter.prepareNativeRenameTracking(conversationId)) {
      this.logger.debug("Native rename draft tracking unavailable.", { conversationId });
      return;
    }
    this.renameDraft.begin(conversationId);
    this.logger.debug("Native rename draft tracking started.", { conversationId });
  }

  private readonly handleNativeRenameInput = (event: Event): void => {
    const state = this.renameDraft.activeState;
    const target = event.target;
    if (!state || !(target instanceof Element)) {
      return;
    }
    const draft = this.adapter.readNativeConversationRenameDraft(target, state.conversationId);
    if (draft === null || !this.renameDraft.update(state.conversationId, draft)) {
      return;
    }
    this.callbacks.onNativeRenameDraft(state.conversationId, draft);
    this.logger.debug("Native rename draft mirrored.", {
      conversationId: state.conversationId,
      length: draft.length,
    });
  };

  private readonly handleNativeRenameFocusOut = (event: FocusEvent): void => {
    const state = this.renameDraft.activeState;
    const target = event.target;
    if (!state || !(target instanceof Element) ||
      !this.adapter.isNativeConversationRenameEditor(target, state.conversationId)) {
      return;
    }
    queueMicrotask(() => {
      const active = document.activeElement;
      if (active instanceof Element &&
        this.adapter.isNativeConversationRenameEditor(active, state.conversationId)) {
        return;
      }
      this.finishNativeRename(state.conversationId);
    });
  };

  private finishNativeRename(conversationId: string): void {
    const state = this.renameDraft.finish(conversationId);
    if (!state) {
      return;
    }
    this.adapter.finishNativeRenameTracking(conversationId);
    void this.callbacks.onNativeRenameFinished(conversationId);
    this.logger.debug("Native rename draft tracking finished.", { conversationId });
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
      context.menu.querySelector('[data-wolf-expansion="quick-access-menu-actions"]')?.remove();
      return;
    }
    try {
      const [favorite, folders, memberships] = await Promise.all([
        this.favoritesRepository.isFavorite(context.conversation.conversationId),
        settings.folders.enabled ? this.foldersRepository.listFolders() : Promise.resolve([]),
        settings.folders.enabled ? this.foldersRepository.listMembership() : Promise.resolve([]),
      ]);
      if (!context.menu.isConnected || this.processedProxyMenus.has(context.menu)) {
        return;
      }
      const membership = memberships.find(
        (item) => item.conversationId === context.conversation.conversationId,
      ) ?? null;
      const oldContainers = Array.from(
        context.menu.querySelectorAll<HTMLElement>('[data-wolf-expansion="quick-access-menu-actions"]'),
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
            void this.membershipService.moveToRoot(context.conversation.conversationId);
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
