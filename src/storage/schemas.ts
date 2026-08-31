export const STORAGE_SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  schemaVersion: "wolfExpansion.schemaVersion",
  settings: "wolfExpansion.settings",
  favorites: "wolfExpansion.favorites",
  uiState: "wolfExpansion.uiState",
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
  };
}
