import type {
  FavoriteConversation,
  FolderConversationMembership,
  FolderRecord,
} from "../../storage/schemas";
import { sanitizeConversationTitle } from "../../adapters/chatgpt/conversationIdentity";

export interface QuickAccessChatView {
  conversationId: string;
  title: string;
  url: string;
  sortIndex: number;
  isQuickAccess: boolean;
  folderId: string | null;
}

export interface QuickAccessFolderView {
  folder: FolderRecord;
  folders: QuickAccessFolderView[];
  chats: QuickAccessChatView[];
}

export interface QuickAccessProjection {
  folders: QuickAccessFolderView[];
  looseChats: QuickAccessChatView[];
  visible: boolean;
}

export interface QuickAccessProjectionOptions {
  quickAccessEnabled: boolean;
  foldersEnabled: boolean;
}

export function buildQuickAccessProjection(
  favorites: readonly FavoriteConversation[],
  folders: readonly FolderRecord[],
  memberships: readonly FolderConversationMembership[],
  options: QuickAccessProjectionOptions,
): QuickAccessProjection {
  if (!options.quickAccessEnabled) {
    return { folders: [], looseChats: [], visible: false };
  }

  const favoriteIds = new Set(favorites.map((favorite) => favorite.conversationId));
  const visibleFolderIds = options.foldersEnabled
    ? new Set(folders.map((folder) => folder.id))
    : new Set<string>();
  const visibleMembershipByConversation = new Map(
    memberships
      .filter((membership) => visibleFolderIds.has(membership.folderId))
      .map((membership) => [membership.conversationId, membership]),
  );

  const looseChats = options.quickAccessEnabled
    ? favorites
      .filter((favorite) => !visibleMembershipByConversation.has(favorite.conversationId))
      .sort(compareBySortIndex)
      .map((favorite) => ({
        conversationId: favorite.conversationId,
        title: sanitizeConversationTitle(favorite.title) || "Untitled conversation",
        url: favorite.url,
        sortIndex: favorite.sortIndex,
        isQuickAccess: true,
        folderId: null,
      }))
    : [];

  if (!options.foldersEnabled) {
    return { folders: [], looseChats, visible: true };
  }

  const views = new Map<string, QuickAccessFolderView>();
  for (const folder of folders) {
    views.set(folder.id, { folder, folders: [], chats: [] });
  }
  for (const membership of memberships) {
    if (!favoriteIds.has(membership.conversationId)) {
      continue;
    }
    const folder = views.get(membership.folderId);
    if (!folder) {
      continue;
    }
    folder.chats.push({
      conversationId: membership.conversationId,
      title: sanitizeConversationTitle(membership.title) || "Untitled conversation",
      url: membership.url,
      sortIndex: membership.sortIndex,
      isQuickAccess: true,
      folderId: membership.folderId,
    });
  }

  const rootFolders: QuickAccessFolderView[] = [];
  for (const folder of views.values()) {
    const parent = folder.folder.parentId ? views.get(folder.folder.parentId) : null;
    if (parent) {
      parent.folders.push(folder);
    } else {
      rootFolders.push(folder);
    }
  }
  sortHierarchy(rootFolders);
  return { folders: rootFolders, looseChats, visible: true };
}

export function getValidFolderDestinations(
  folders: readonly FolderRecord[],
  movingFolderId: string,
): FolderRecord[] {
  const excluded = collectDescendantIds(folders, movingFolderId);
  excluded.add(movingFolderId);
  return folders.filter((folder) => !excluded.has(folder.id)).sort(compareBySortIndex);
}

function collectDescendantIds(
  folders: readonly FolderRecord[],
  parentId: string,
): Set<string> {
  const descendants = new Set<string>();
  const pending = [parentId];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    for (const folder of folders) {
      if (folder.parentId === current && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        pending.push(folder.id);
      }
    }
  }
  return descendants;
}

function sortHierarchy(folders: QuickAccessFolderView[]): void {
  folders.sort((left, right) => compareBySortIndex(left.folder, right.folder));
  for (const folder of folders) {
    folder.folders.sort((left, right) => compareBySortIndex(left.folder, right.folder));
    folder.chats.sort(compareBySortIndex);
    sortHierarchy(folder.folders);
  }
}

function compareBySortIndex(
  left: { sortIndex: number; createdAt?: number; assignedAt?: number },
  right: { sortIndex: number; createdAt?: number; assignedAt?: number },
): number {
  return left.sortIndex - right.sortIndex ||
    (left.createdAt ?? left.assignedAt ?? 0) - (right.createdAt ?? right.assignedAt ?? 0);
}
