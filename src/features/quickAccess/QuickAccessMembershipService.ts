import type { NormalizedConversationIdentity } from "../../adapters/chatgpt/conversationIdentity";
import type { Logger } from "../../core/logger";
import { FavoritesRepository } from "../favorites/FavoritesRepository";
import { FoldersRepository } from "../folders/FoldersRepository";

export class QuickAccessMembershipService {
  public constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly foldersRepository: FoldersRepository,
    private readonly logger?: Logger,
  ) {}

  public async isInQuickAccess(conversationId: string): Promise<boolean> {
    return this.favoritesRepository.isFavorite(conversationId);
  }

  public async addToQuickAccess(conversation: NormalizedConversationIdentity): Promise<void> {
    await this.favoritesRepository.add(conversation);
    this.logger?.debug("Conversation added to Quick Access.", {
      conversationId: conversation.conversationId,
    });
  }

  public async removeFromQuickAccess(conversationId: string): Promise<void> {
    const membership = await this.foldersRepository.getMembership(conversationId);
    if (membership) {
      await this.foldersRepository.removeConversation(conversationId);
    }
    try {
      await this.favoritesRepository.remove(conversationId);
      this.logger?.debug("Conversation removed completely from Quick Access.", {
        conversationId,
        folderMembershipRemoved: membership !== null,
      });
    } catch (error) {
      if (membership) {
        try {
          await this.foldersRepository.assignConversation(membership.folderId, {
            conversationId: membership.conversationId,
            title: membership.title,
            url: membership.url,
          });
          this.logger?.debug("Quick Access removal rolled folder membership back.", {
            conversationId,
            folderId: membership.folderId,
          });
        } catch (rollbackError) {
          this.logger?.error(
            "Quick Access removal rollback failed; stored records need local recovery.",
            rollbackError,
          );
        }
      }
      throw error;
    }
  }

  public async toggle(conversation: NormalizedConversationIdentity): Promise<boolean> {
    const existing = await this.isInQuickAccess(conversation.conversationId);
    if (existing) {
      await this.removeFromQuickAccess(conversation.conversationId);
      return false;
    }
    await this.addToQuickAccess(conversation);
    return true;
  }

  public async assignToFolder(
    folderId: string,
    conversation: NormalizedConversationIdentity,
  ): Promise<void> {
    const existed = await this.isInQuickAccess(conversation.conversationId);
    if (!existed) {
      await this.favoritesRepository.add(conversation);
    }
    try {
      await this.foldersRepository.assignConversation(folderId, conversation);
      this.logger?.debug("Quick Access conversation assigned to folder.", {
        conversationId: conversation.conversationId,
        folderId,
        addedToQuickAccess: !existed,
      });
    } catch (error) {
      if (!existed) {
        try {
          await this.favoritesRepository.remove(conversation.conversationId);
        } catch (rollbackError) {
          this.logger?.error(
            "Folder assignment rollback failed; conversation remains in Quick Access root.",
            rollbackError,
          );
        }
      }
      throw error;
    }
  }

  public async moveToRoot(conversationId: string): Promise<void> {
    await this.foldersRepository.removeConversation(conversationId);
    this.logger?.debug("Quick Access conversation moved to root.", { conversationId });
  }
}
