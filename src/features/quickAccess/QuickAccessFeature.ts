import type {
  ChatGPTAdapter,
  ConversationReference,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import { normalizeConversationIdentity } from "../../adapters/chatgpt/conversationIdentity";
import type { Logger } from "../../core/logger";
import type { WolfSidebarRoot } from "../../core/WolfSidebarRoot";
import { debounce } from "../../shared/events";
import type { Feature, Unsubscribe } from "../../shared/types";
import type { WolfExpansionSettings } from "../../storage/schemas";
import { FavoritesRepository } from "../favorites/FavoritesRepository";
import { FoldersRepository } from "../folders/FoldersRepository";
import { QuickAccessMenuIntegration } from "./QuickAccessMenuIntegration";
import { QuickAccessMembershipService } from "./QuickAccessMembershipService";
import { buildQuickAccessProjection } from "./quickAccessProjection";
import { QuickAccessSidebar } from "./QuickAccessSidebar";
import { QuickAccessUiStateRepository } from "./QuickAccessUiStateRepository";

export class QuickAccessFeature implements Feature {
  public readonly id = "quick-access";

  private enabled = false;
  private collapsed = false;
  private settings: WolfExpansionSettings | null = null;
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly transientFolderCollapse = new Map<string, boolean>();
  private readonly sidebar: QuickAccessSidebar;
  private readonly menuIntegration: QuickAccessMenuIntegration;
  private readonly scheduleRefresh: () => void;
  private readonly membershipService: QuickAccessMembershipService;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly favoritesRepository: FavoritesRepository,
    private readonly foldersRepository: FoldersRepository,
    private readonly uiStateRepository: QuickAccessUiStateRepository,
    sidebarRoot: WolfSidebarRoot,
    private readonly logger: Logger,
  ) {
    this.scheduleRefresh = debounce(() => void this.refresh(), 100);
    this.membershipService = new QuickAccessMembershipService(
      favoritesRepository,
      foldersRepository,
      logger,
    );
    this.sidebar = new QuickAccessSidebar(
      adapter,
      {
        onSectionCollapseChange: async (collapsed) => {
          this.collapsed = collapsed;
          if (this.settings?.favorites.rememberCollapsed) {
            await this.uiStateRepository.save({ collapsed });
          }
          await this.refresh();
        },
        onToggleQuickAccess: async (conversation) => {
          return this.membershipService.toggle(conversation);
        },
        onRemoveQuickAccess: (conversationId) =>
          this.membershipService.removeFromQuickAccess(conversationId),
        onReorderRootChats: (conversationIds) =>
          this.favoritesRepository.reorder(conversationIds),
        onFolderCollapseChange: async (folderId, collapsed) => {
          if (this.settings?.folders.rememberCollapsed) {
            await this.foldersRepository.setFolderCollapsed(folderId, collapsed);
          } else {
            this.transientFolderCollapse.set(folderId, collapsed);
            await this.refresh();
          }
        },
        onCreateFolder: (name, parentId) =>
          this.foldersRepository.createFolder(name, parentId).then(() => undefined),
        onRenameFolder: (folderId, name) =>
          this.foldersRepository.renameFolder(folderId, name),
        onMoveFolder: (folderId, parentId, targetIndex) =>
          this.foldersRepository.moveFolder(folderId, parentId, targetIndex),
        onMoveFolderByOne: (folderId, direction) =>
          this.foldersRepository.reorderFolder(folderId, direction),
        onDeleteFolder: (folderId) => this.foldersRepository.deleteFolder(folderId),
        onAssignConversation: async (folderId, conversation, source) => {
          await this.membershipService.assignToFolder(folderId, conversation);
          if (source === "quick-access-chat") {
            this.logger.debug("Quick Access chat assigned to folder.", {
              conversationId: conversation.conversationId,
              folderId,
            });
          } else if (source === "folder-chat") {
            this.logger.debug("Folder chat moved.", {
              conversationId: conversation.conversationId,
              folderId,
            });
          }
        },
        onRemoveConversationFromFolder: (conversationId) =>
          this.membershipService.moveToRoot(conversationId),
        onReorderFolderChats: async (folderId, conversationIds) => {
          await this.foldersRepository.reorderConversations(folderId, conversationIds);
          this.logger.debug("Chat reordered.", { folderId });
        },
        onDebugToggleCurrentConversation: async () => {
          const current = this.adapter.getCurrentConversationIdentity();
          if (!current) {
            this.logger.debug("Debug Quick Access action aborted: no current conversation.");
            return;
          }
          await this.membershipService.toggle(current);
        },
      },
      sidebarRoot,
      logger,
    );
    this.menuIntegration = new QuickAccessMenuIntegration(
      adapter,
      favoritesRepository,
      foldersRepository,
      this.membershipService,
      logger,
    );
  }

  public async setSettings(settings: WolfExpansionSettings): Promise<void> {
    const previouslyRemembered = this.settings?.favorites.rememberCollapsed;
    const previouslyRememberedFolders = this.settings?.folders.rememberCollapsed;
    this.settings = settings;
    this.menuIntegration.setSettings(settings);
    if (!settings.favorites.rememberCollapsed && previouslyRemembered !== false) {
      this.collapsed = false;
    }
    if (!settings.folders.rememberCollapsed && previouslyRememberedFolders !== false) {
      this.transientFolderCollapse.clear();
    }
    if (this.enabled) {
      await this.refresh();
    }
  }

  public async enable(): Promise<void> {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    const uiState = await this.uiStateRepository.get();
    this.collapsed = this.settings?.favorites.rememberCollapsed ? uiState.collapsed : false;
    this.unsubscribers.push(
      this.adapter.watchSidebar(this.scheduleRefresh),
      this.adapter.watchNavigation(this.scheduleRefresh),
      this.favoritesRepository.subscribe(this.scheduleRefresh),
      this.foldersRepository.subscribe(this.scheduleRefresh),
    );
    this.menuIntegration.enable();
    await this.refresh();
    this.logger.debug("Quick Access enabled.");
  }

  public disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    while (this.unsubscribers.length > 0) {
      this.unsubscribers.pop()?.();
    }
    this.menuIntegration.disable();
    this.sidebar.remove();
    this.logger.debug("Quick Access disabled.");
  }

  public destroy(): void {
    this.disable();
  }

  private async refresh(): Promise<void> {
    const settings = this.settings;
    if (!this.enabled || !settings) {
      return;
    }
    if (!settings.favorites.enabled) {
      this.sidebar.remove();
      return;
    }
    try {
      const references = this.adapter.findConversationLinks()
        .map((link) => this.adapter.getConversationReference(link))
        .filter((reference): reference is ConversationReference => reference !== null);
      const detected = new Map(
        references.map((reference) => [
          reference.conversationId,
          { title: reference.title, url: reference.url },
        ]),
      );
      await Promise.all([
        this.favoritesRepository.updateDetectedTitles(detected),
        settings.folders.enabled
          ? this.foldersRepository.updateDetectedTitles(detected)
          : Promise.resolve(false),
      ]);
      const [favorites, folders, memberships] = await Promise.all([
        this.favoritesRepository.list(),
        settings.folders.enabled ? this.foldersRepository.listFolders() : Promise.resolve([]),
        settings.folders.enabled ? this.foldersRepository.listMembership() : Promise.resolve([]),
      ]);
      const displayFolders = settings.folders.rememberCollapsed
        ? folders
        : folders.map((folder) => ({
            ...folder,
            collapsed: this.transientFolderCollapse.get(folder.id) ?? false,
          }));
      const projection = buildQuickAccessProjection(favorites, displayFolders, memberships, {
        quickAccessEnabled: settings.favorites.enabled,
        foldersEnabled: settings.folders.enabled,
      });
      const currentId = this.adapter.getCurrentConversationId();
      const currentIsQuickAccess = currentId
        ? favorites.some((favorite) => favorite.conversationId === currentId)
        : false;
      this.sidebar.render(projection, settings, this.collapsed, currentIsQuickAccess);
      this.sidebar.syncNativeRows(
        references,
        new Set(favorites.map((favorite) => favorite.conversationId)),
        settings.favorites.showIcon,
        settings.folders.enabled,
      );
    } catch (error) {
      this.logger.warn("Quick Access could not refresh; stored organization was untouched.", error);
    }
  }
}
