export const STORAGE_SCHEMA_VERSION = 5;

export type ItemNameDisplayMode = "compact" | "full";

export const STORAGE_KEYS = {
  schemaVersion: "wolfExpansion.schemaVersion",
  settings: "wolfExpansion.settings",
  favorites: "wolfExpansion.favorites",
  uiState: "wolfExpansion.uiState",
  folders: "wolfExpansion.folders",
  folderMembership: "wolfExpansion.folderMembership",
  foldersUiState: "wolfExpansion.foldersUiState",
  quickAccessUiState: "wolfExpansion.quickAccessUiState",
} as const;

export interface FavoriteConversation {
  conversationId: string;
  title: string;
  url: string;
  addedAt: number;
  sortIndex: number;
}

export interface FavoritesUiState {
  collapsed: boolean;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  sortIndex: number;
  createdAt: number;
  collapsed: boolean;
}

export interface FolderConversationMembership {
  conversationId: string;
  folderId: string;
  title: string;
  url: string;
  assignedAt: number;
  sortIndex: number;
}

export interface FoldersUiState {
  collapsed: boolean;
}

export interface QuickAccessUiState {
  collapsed: boolean;
}

export interface WolfExpansionSettings {
  schemaVersion: number;
  enabled: boolean;
  debug: {
    enabled: boolean;
  };
  favorites: {
    enabled: boolean;
    showIcon: boolean;
    rememberCollapsed: boolean;
    itemNameDisplay: ItemNameDisplayMode;
  };
  folders: {
    enabled: boolean;
    rememberCollapsed: boolean;
    showIcons: boolean;
  };
}
