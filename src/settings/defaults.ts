import { STORAGE_SCHEMA_VERSION, type WolfExpansionSettings } from "../storage/schemas";

export const DEFAULT_SETTINGS: WolfExpansionSettings = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  enabled: true,
  debug: {
    enabled: false,
  },
  favorites: {
    enabled: true,
    showIcon: true,
    rememberCollapsed: true,
  },
};
