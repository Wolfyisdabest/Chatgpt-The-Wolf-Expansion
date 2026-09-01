import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { SettingsService } from "../src/settings/settings";
import { normalizeSettings } from "../src/storage/migrations";
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../src/storage/schemas";
import { MemoryStorage } from "./helpers/MemoryStorage";

test("uses the shared settings defaults for missing data", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
});

test("migrates older settings and adds the current folders defaults", () => {
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
  assert.equal(migrated.favorites.itemNameDisplay, "compact");
  assert.deepEqual(migrated.folders, DEFAULT_SETTINGS.folders);
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
  assert.deepEqual(updated.folders, DEFAULT_SETTINGS.folders);
});

test("merges partial folder settings without resetting sibling values", async () => {
  const settingsService = new SettingsService(new MemoryStorage());
  await settingsService.update({ folders: { showIcons: false } });
  const updated = await settingsService.update({ folders: { enabled: false } });

  assert.equal(updated.folders.enabled, false);
  assert.equal(updated.folders.showIcons, false);
  assert.equal(updated.folders.rememberCollapsed, true);
});

test("migrates and updates the shared Quick Access item-name display mode", async () => {
  assert.equal(normalizeSettings({
    favorites: { itemNameDisplay: "full" },
  }).favorites.itemNameDisplay, "full");
  assert.equal(normalizeSettings({
    favorites: { itemNameDisplay: "unexpected" },
  }).favorites.itemNameDisplay, "compact");

  const settingsService = new SettingsService(new MemoryStorage());
  const updated = await settingsService.update({
    favorites: { itemNameDisplay: "full" },
  });
  assert.equal(updated.favorites.itemNameDisplay, "full");
  assert.equal(updated.favorites.enabled, true);
});

test("migration preserves the global display mode and creates no folder overrides", () => {
  const migrated = normalizeSettings({
    schemaVersion: 5,
    favorites: { itemNameDisplay: "full" },
    folders: { enabled: true },
  });
  assert.equal(migrated.favorites.itemNameDisplay, "full");
  assert.deepEqual(migrated.folders.chatNameDisplayOverrides, {});
});

test("folder display overrides persist and synchronize through the shared service", async () => {
  const storage = new MemoryStorage();
  const inChatSettings = new SettingsService(storage);
  const browserPreferences = new SettingsService(storage);

  await inChatSettings.setFolderChatNameDisplay("folder-a", "full");
  assert.deepEqual(
    (await browserPreferences.get()).folders.chatNameDisplayOverrides,
    { "folder-a": "full" },
  );
  await browserPreferences.setFolderChatNameDisplay("folder-a", null);
  assert.deepEqual(
    (await inChatSettings.get()).folders.chatNameDisplayOverrides,
    {},
  );
});

test("invalid persisted folder override values are discarded", () => {
  const normalized = normalizeSettings({
    folders: {
      chatNameDisplayOverrides: {
        valid: "compact",
        invalid: "giant",
        "": "full",
      },
    },
  });
  assert.deepEqual(normalized.folders.chatNameDisplayOverrides, { valid: "compact" });
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

test("both settings frontends expose the shared global and folder override controls", () => {
  const inChat = readFileSync(
    path.join(process.cwd(), "src/features/settings/InChatSettingsFeature.ts"),
    "utf8",
  );
  const preferences = readFileSync(
    path.join(process.cwd(), "src/settings/options/options.html"),
    "utf8",
  );
  assert.match(inChat, /Default chat-name display/);
  assert.match(inChat, /Manage folder overrides/);
  assert.match(preferences, /Default chat-name display/);
  assert.match(preferences, /Manage folder overrides/);
});
