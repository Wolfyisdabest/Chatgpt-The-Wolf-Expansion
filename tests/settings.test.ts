import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { SettingsService } from "../src/settings/settings";
import { normalizeSettings } from "../src/storage/migrations";
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../src/storage/schemas";
import { MemoryStorage } from "./helpers/MemoryStorage";

test("uses the shared settings defaults for missing data", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
});

test("migrates the v1 debugLogging field into the v2 debug structure", () => {
  const migrated = normalizeSettings({
    schemaVersion: 1,
    enabled: false,
    debugLogging: true,
    favorites: {
      enabled: true,
      showIcon: false,
      rememberCollapsed: false,
    },
  });

  assert.equal(migrated.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.deepEqual(migrated.debug, { enabled: true });
  assert.equal(migrated.enabled, false);
  assert.equal(migrated.favorites.showIcon, false);
});

test("merges partial settings updates without resetting sibling values", async () => {
  const storage = new MemoryStorage();
  const settingsService = new SettingsService(storage);
  await storage.set(STORAGE_KEYS.settings, {
    ...DEFAULT_SETTINGS,
    favorites: {
      ...DEFAULT_SETTINGS.favorites,
      showIcon: false,
    },
  });

  const updated = await settingsService.update({ debug: { enabled: true } });
  assert.equal(updated.debug.enabled, true);
  assert.equal(updated.favorites.showIcon, false);
  assert.equal(updated.favorites.enabled, true);
});

test("shares one authoritative settings record between service instances", async () => {
  const storage = new MemoryStorage();
  const inChatSettings = new SettingsService(storage);
  const browserPreferences = new SettingsService(storage);

  await inChatSettings.update({ favorites: { enabled: false } });
  assert.equal((await browserPreferences.get()).favorites.enabled, false);

  await browserPreferences.update({ favorites: { showIcon: false } });
  const synchronized = await inChatSettings.get();
  assert.equal(synchronized.favorites.enabled, false);
  assert.equal(synchronized.favorites.showIcon, false);
});
