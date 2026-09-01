import type { Unsubscribe } from "../shared/types";
import { normalizeSettings } from "../storage/migrations";
import {
  STORAGE_KEYS,
  type ItemNameDisplayMode,
  type WolfExpansionSettings,
} from "../storage/schemas";
import type { KeyValueStorage } from "../storage/StorageService";
import { DEFAULT_SETTINGS } from "./defaults";

export interface SettingsUpdate {
  enabled?: boolean;
  debug?: {
    enabled?: boolean;
  };
  favorites?: {
    enabled?: boolean;
    showIcon?: boolean;
    rememberCollapsed?: boolean;
    itemNameDisplay?: ItemNameDisplayMode;
  };
  folders?: {
    enabled?: boolean;
    rememberCollapsed?: boolean;
    showIcons?: boolean;
  };
}

export class SettingsService {
  public constructor(private readonly storage: KeyValueStorage) {}

  public async get(): Promise<WolfExpansionSettings> {
    const value = await this.storage.get<unknown>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    return normalizeSettings(value);
  }

  public async save(settings: WolfExpansionSettings): Promise<void> {
    await this.storage.set(STORAGE_KEYS.settings, normalizeSettings(settings));
  }

  public async update(update: SettingsUpdate): Promise<WolfExpansionSettings> {
    const current = await this.get();
    const next: WolfExpansionSettings = {
      ...current,
      enabled: update.enabled ?? current.enabled,
      debug: {
        enabled: update.debug?.enabled ?? current.debug.enabled,
      },
      favorites: {
        enabled: update.favorites?.enabled ?? current.favorites.enabled,
        showIcon: update.favorites?.showIcon ?? current.favorites.showIcon,
        rememberCollapsed:
          update.favorites?.rememberCollapsed ?? current.favorites.rememberCollapsed,
        itemNameDisplay:
          update.favorites?.itemNameDisplay ?? current.favorites.itemNameDisplay,
      },
      folders: {
        enabled: update.folders?.enabled ?? current.folders.enabled,
        rememberCollapsed:
          update.folders?.rememberCollapsed ?? current.folders.rememberCollapsed,
        showIcons: update.folders?.showIcons ?? current.folders.showIcons,
      },
    };
    await this.save(next);
    return next;
  }

  public subscribe(listener: () => void): Unsubscribe {
    return this.storage.subscribe(STORAGE_KEYS.settings, listener);
  }
}
