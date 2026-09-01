import type {
  ChatGPTAdapter,
  ConversationReference,
} from "../../adapters/chatgpt/ChatGPTAdapter";
import {
  collectDetectedConversationMetadata,
  normalizeConversationIdentity,
} from "../../adapters/chatgpt/conversationIdentity";
import type { Logger } from "../../core/logger";
import { debounce } from "../../shared/events";
import type { Feature, Unsubscribe } from "../../shared/types";
import type { WolfExpansionSettings } from "../../storage/schemas";
import { FavoritesMenuIntegration } from "./FavoritesMenuIntegration";
import { FavoritesRepository } from "./FavoritesRepository";
import { FavoritesSidebar } from "./FavoritesSidebar";

export class FavoritesFeature implements Feature {
  public readonly id = "favorites";

  private enabled = false;
  private collapsed = false;
  private settings: WolfExpansionSettings | null = null;
  private readonly unsubscribers: Unsubscribe[] = [];
  private readonly sidebar: FavoritesSidebar;
  private readonly menuIntegration: FavoritesMenuIntegration;
  private readonly scheduleRefresh: () => void;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly repository: FavoritesRepository,
    private readonly logger: Logger,
  ) {
    this.scheduleRefresh = debounce(() => {
      void this.refresh();
    }, 100);
    this.sidebar = new FavoritesSidebar(
      adapter,
      {
        onCollapseChange: async (collapsed) => {
          this.collapsed = collapsed;
          if (this.settings?.favorites.rememberCollapsed) {
            await this.repository.saveUiState({ collapsed });
          }
          await this.refresh();
        },
        onRemove: async (conversationId) => {
          await this.repository.remove(conversationId);
        },
        onReorder: async (conversationIds) => {
          await this.repository.reorder(conversationIds);
        },
        onSidebarFavoriteAction: async (conversation) => {
          const normalized = normalizeConversationIdentity(conversation);
          if (!normalized.ok) {
            this.logger.debug(`Sidebar Favorite aborted: ${normalized.reason}.`);
            return null;
          }

          const { conversation: identity } = normalized;
          const currentlyFavorite = await this.repository.isFavorite(identity.conversationId);
          const intendedOperation = currentlyFavorite ? "remove" : "add";
          this.logger.debug(`conversationId=${identity.conversationId}`);
          this.logger.debug(`currentlyFavorite=${currentlyFavorite}`);
          this.logger.debug(`intendedOperation=${intendedOperation}`);
          this.logger.debug("Sidebar Favorite repository operation started.", {
            operation: intendedOperation,
            titleResolved: normalized.titleResolved,
            url: identity.url,
            sourceHadDomLink: "link" in conversation,
          });

          if (currentlyFavorite) {
            await this.repository.remove(identity.conversationId);
          } else {
            await this.repository.add(identity);
          }

          this.logger.debug("Sidebar Favorite repository operation completed.", {
            operation: intendedOperation,
            conversationId: identity.conversationId,
          });
          return !currentlyFavorite;
        },
        onDebugToggleCurrentConversation: async () => {
          const conversation = this.adapter.getCurrentConversationIdentity();
          if (!conversation) {
            this.logger.debug(
              "Debug current-chat Favorite aborted: no current conversation could be resolved.",
            );
            return;
          }

          this.logger.debug("Debug current-chat pipeline: repository toggle called.", {
            conversationId: conversation.conversationId,
            url: conversation.url,
          });
          await this.repository.toggle(conversation);
        },
      },
      logger,
    );
    this.menuIntegration = new FavoritesMenuIntegration(
      adapter,
      repository,
      logger,
    );
  }

  public async setSettings(settings: WolfExpansionSettings): Promise<void> {
    this.settings = settings;
    if (!settings.favorites.rememberCollapsed) {
      this.collapsed = false;
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
    this.collapsed = this.settings?.favorites.rememberCollapsed ? uiState.collapsed : false;
    this.unsubscribers.push(
      this.adapter.watchSidebar(this.scheduleRefresh),
      this.adapter.watchNavigation(this.scheduleRefresh),
      this.repository.subscribe((event) => {
        if (event.type === "storage-synchronized") {
          this.scheduleRefresh();
        } else {
          void this.refresh();
        }
      }),
    );
    this.menuIntegration.enable();
    await this.refresh();
    this.logger.debug("Favorites enabled.");
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
    this.logger.debug("Favorites disabled.");
  }

  public destroy(): void {
    this.disable();
  }

  private async refresh(): Promise<void> {
    if (!this.enabled || !this.settings) {
      return;
    }

    try {
      const links = this.adapter.findConversationLinks();
      const conversations = links
        .map((link) => this.adapter.getConversationReference(link))
        .filter((conversation): conversation is ConversationReference => conversation !== null);
      this.logger.debug("Conversation rows discovered.", conversations.length);
      const detectedTitles = collectDetectedConversationMetadata(conversations);

      await this.repository.updateDetectedTitles(detectedTitles);
      const favorites = await this.repository.list();
      const favoriteIds = new Set(favorites.map((favorite) => favorite.conversationId));
      this.sidebar.render(favorites, this.settings, this.collapsed);
      this.sidebar.syncConversationButtons(conversations, favoriteIds);
      this.logger.debug("Favorite pipeline: Favorites section reconciled.", {
        count: favorites.length,
      });
    } catch (error) {
      this.logger.warn("Favorites could not refresh; saved data was left untouched.", error);
    }
  }
}
