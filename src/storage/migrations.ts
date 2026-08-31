import { DEFAULT_SETTINGS } from "../settings/defaults";
import {
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  type FavoriteConversation,
  type FavoritesUiState,
  type WolfExpansionSettings,
} from "./schemas";
import type { KeyValueStorage } from "./StorageService";

const DEFAULT_UI_STATE: FavoritesUiState = { collapsed: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function migrateStorage(storage: KeyValueStorage): Promise<void> {
  const rawSchemaVersion = await storage.get<unknown>(STORAGE_KEYS.schemaVersion, undefined);
  const rawSettings = await storage.get<unknown>(STORAGE_KEYS.settings, undefined);
  const settings = normalizeSettings(rawSettings);
  const rawFavorites = await storage.get<unknown>(STORAGE_KEYS.favorites, []);
  const favorites = normalizeFavorites(rawFavorites);
  const rawUiState = await storage.get<unknown>(STORAGE_KEYS.uiState, DEFAULT_UI_STATE);
  const uiState = normalizeUiState(rawUiState);

  const changes: Record<string, unknown> = {};
  if (rawSchemaVersion !== STORAGE_SCHEMA_VERSION) {
    changes[STORAGE_KEYS.schemaVersion] = STORAGE_SCHEMA_VERSION;
  }
  if (JSON.stringify(rawSettings) !== JSON.stringify(settings)) {
    changes[STORAGE_KEYS.settings] = settings;
  }
  if (JSON.stringify(rawFavorites) !== JSON.stringify(favorites)) {
    changes[STORAGE_KEYS.favorites] = favorites;
  }
  if (JSON.stringify(rawUiState) !== JSON.stringify(uiState)) {
    changes[STORAGE_KEYS.uiState] = uiState;
  }

  if (Object.keys(changes).length > 0) {
    await storage.setMany(changes);
  }
}

export function normalizeSettings(value: unknown): WolfExpansionSettings {
  const root = isRecord(value) ? value : {};
  const debug = isRecord(root.debug) ? root.debug : {};
  const favorites = isRecord(root.favorites) ? root.favorites : {};

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    enabled: readBoolean(root.enabled, DEFAULT_SETTINGS.enabled),
    debug: {
      enabled: readBoolean(
        debug.enabled,
        readBoolean(root.debugLogging, DEFAULT_SETTINGS.debug.enabled),
      ),
    },
    favorites: {
      enabled: readBoolean(favorites.enabled, DEFAULT_SETTINGS.favorites.enabled),
      showIcon: readBoolean(favorites.showIcon, DEFAULT_SETTINGS.favorites.showIcon),
      rememberCollapsed: readBoolean(
        favorites.rememberCollapsed,
        DEFAULT_SETTINGS.favorites.rememberCollapsed,
      ),
    },
  };
}

export function normalizeFavorites(value: unknown): FavoriteConversation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  const favorites: FavoriteConversation[] = [];

  for (const item of value) {
    if (!isRecord(item) || typeof item.conversationId !== "string") {
      continue;
    }

    const conversationId = item.conversationId.trim();
    if (!conversationId || seenIds.has(conversationId)) {
      continue;
    }

    const title = typeof item.title === "string" && item.title.trim()
      ? item.title.trim()
      : "Untitled conversation";
    const url = typeof item.url === "string" && item.url.startsWith("https://chatgpt.com/c/")
      ? item.url
      : `https://chatgpt.com/c/${encodeURIComponent(conversationId)}`;

    seenIds.add(conversationId);
    favorites.push({
      conversationId,
      title,
      url,
      addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
      sortIndex: typeof item.sortIndex === "number" ? item.sortIndex : favorites.length,
    });
  }

  return favorites
    .sort((left, right) => left.sortIndex - right.sortIndex || left.addedAt - right.addedAt)
    .map((favorite, sortIndex) => ({ ...favorite, sortIndex }));
}

export function normalizeUiState(value: unknown): FavoritesUiState {
  const state = isRecord(value) ? value : {};
  return { collapsed: readBoolean(state.collapsed, DEFAULT_UI_STATE.collapsed) };
}
