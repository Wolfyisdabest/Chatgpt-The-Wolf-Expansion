import type {
  ChatGPTAdapter,
  ConversationReference,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import { collectDetectedConversationMetadata } from "../../adapters/chatgpt/conversationIdentity";
import type { Logger } from "../../core/logger";
import { debounce } from "../../shared/events";
import type { Feature, Unsubscribe } from "../../shared/types";
import type { WolfExpansionSettings } from "../../storage/schemas";
import { FoldersMenuIntegration } from "./FoldersMenuIntegration";
import { FoldersRepository, type FolderTreeNode } from "./FoldersRepository";
import { FoldersSidebar } from "./FoldersSidebar";

export class FoldersFeature implements Feature {
  public readonly id = "folders";

  private enabled = false;
  private sectionCollapsed = false;
  private settings: WolfExpansionSettings | null = null;
  private readonly transientFolderCollapse = new Map<string, boolean>();
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly sidebar: FoldersSidebar;
  private readonly menuIntegration: FoldersMenuIntegration;
  private readonly scheduleRefresh: () => void;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly repository: FoldersRepository,
    private readonly logger: Logger,
  ) {
    this.scheduleRefresh = debounce(() => {
      void this.refresh();
    }, 100);
    this.sidebar = new FoldersSidebar(
      adapter,
      {
        onSectionCollapseChange: async (collapsed) => {
          this.sectionCollapsed = collapsed;
          if (this.settings?.folders.rememberCollapsed) {
            await this.repository.saveUiState({ collapsed });
          }
          await this.refresh();
        },
        onFolderCollapseChange: async (folderId, collapsed) => {
          if (this.settings?.folders.rememberCollapsed) {
            await this.repository.setFolderCollapsed(folderId, collapsed);
          } else {
            this.transientFolderCollapse.set(folderId, collapsed);
            await this.refresh();
          }
        },
        onCreate: async (name, parentId) => {
          await this.repository.createFolder(name, parentId);
        },
        onRename: async (folderId, name) => {
          await this.repository.renameFolder(folderId, name);
        },
        onMove: async (folderId, parentId) => {
          await this.repository.moveFolder(folderId, parentId);
        },
        onDelete: async (folderId) => {
          await this.repository.deleteFolder(folderId);
        },
        onReorder: async (folderId, direction) => {
          await this.repository.reorderFolder(folderId, direction);
        },
      },
      logger,
    );
    this.menuIntegration = new FoldersMenuIntegration(adapter, repository, logger);
  }

  public async setSettings(settings: WolfExpansionSettings): Promise<void> {
    const wasRememberingCollapse = this.settings?.folders.rememberCollapsed;
    this.settings = settings;
    if (!settings.folders.rememberCollapsed && wasRememberingCollapse !== false) {
      this.sectionCollapsed = false;
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
    const uiState = await this.repository.getUiState();
    this.sectionCollapsed = this.settings?.folders.rememberCollapsed
      ? uiState.collapsed
      : false;
    this.unsubscribers.push(
      this.adapter.watchSidebar(this.scheduleRefresh),
      this.adapter.watchNavigation(this.scheduleRefresh),
      this.repository.subscribe(() => this.scheduleRefresh()),
    );
    this.menuIntegration.enable();
    await this.refresh();
    this.logger.debug("Folders enabled.");
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
    this.transientFolderCollapse.clear();
    this.logger.debug("Folders disabled.");
  }

  public destroy(): void {
    this.disable();
  }

  private async refresh(): Promise<void> {
    if (!this.enabled || !this.settings) {
      return;
    }
    try {
      const conversations = this.adapter.findConversationLinks()
        .map((link) => this.adapter.getConversationReference(link))
        .filter((conversation): conversation is ConversationReference => conversation !== null);
      const detectedTitles = collectDetectedConversationMetadata(conversations);
      await this.repository.updateDetectedTitles(detectedTitles);
      const tree = this.applyTransientCollapse(await this.repository.getTree());
      this.sidebar.render(tree, this.settings, this.sectionCollapsed);
    } catch (error) {
      this.logger.warn("Folders could not refresh; saved data was left untouched.", error);
    }
  }

  private applyTransientCollapse(tree: FolderTreeNode[]): FolderTreeNode[] {
    if (this.settings?.folders.rememberCollapsed) {
      return tree;
    }
    return tree.map((node) => ({
      folder: {
        ...node.folder,
        collapsed: this.transientFolderCollapse.get(node.folder.id) ?? false,
      },
      conversations: node.conversations,
      children: this.applyTransientCollapse(node.children),
    }));
  }
}
