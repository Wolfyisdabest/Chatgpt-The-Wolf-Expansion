import assert from "node:assert/strict";
import test from "node:test";
import { FavoritesRepository } from "../src/features/favorites/FavoritesRepository";
import { FoldersRepository } from "../src/features/folders/FoldersRepository";
import { FolderDisplayOverridesRepository } from "../src/features/folders/FolderDisplayOverridesRepository";
import { AccountScopedStorage } from "../src/storage/AccountScopedStorage";
import { LegacyAccountRecoveryService } from "../src/storage/LegacyAccountRecoveryService";
import {
  STORAGE_KEYS,
  type FavoriteConversation,
  type LegacyAccountData,
} from "../src/storage/schemas";
import { MemoryStorage } from "./helpers/MemoryStorage";

const ACCOUNT_A = "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ACCOUNT_B = "sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function createLegacyData(): LegacyAccountData {
  const favorites: FavoriteConversation[] = Array.from({ length: 6 }, (_, index) => ({
    conversationId: `legacy-conversation-${index + 1}`,
    title: `Legacy conversation ${index + 1}`,
    url: `https://chatgpt.com/c/legacy-conversation-${index + 1}`,
    addedAt: index + 1,
    sortIndex: index,
  }));
  return {
    preservedAt: 100,
    sourceSchemaVersion: 6,
    claimedToScopeId: null,
    claimedAt: null,
    favorites,
    uiState: { collapsed: true },
    folders: [{
      id: "legacy-folder",
      name: "Legacy folder",
      parentId: null,
      sortIndex: 0,
      createdAt: 1,
      collapsed: true,
    }],
    folderMembership: [{
      conversationId: favorites[0]!.conversationId,
      folderId: "legacy-folder",
      title: favorites[0]!.title,
      url: favorites[0]!.url,
      assignedAt: 1,
      sortIndex: 0,
    }],
    foldersUiState: { collapsed: true },
    quickAccessUiState: { collapsed: true },
    folderChatNameDisplayOverrides: { "legacy-folder": "full" },
  };
}

test("explicit restore claims complete legacy organization for the identified empty account", async () => {
  const base = new MemoryStorage();
  const legacy = createLegacyData();
  const {
    claimedToScopeId: _missingClaimScopeInExistingSchema7,
    claimedAt: _missingClaimTimeInExistingSchema7,
    ...existingSchema7Legacy
  } = legacy;
  await base.set(STORAGE_KEYS.legacyAccountData, existingSchema7Legacy);
  const scoped = new AccountScopedStorage(base);
  scoped.setScope(ACCOUNT_A);
  const favorites = new FavoritesRepository(scoped);
  const folders = new FoldersRepository(scoped);
  const overrides = new FolderDisplayOverridesRepository(scoped);
  const recovery = new LegacyAccountRecoveryService(base, scoped);
  let storageNotifications = 0;
  const unsubscribe = favorites.subscribe(() => {
    storageNotifications += 1;
  });

  assert.deepEqual(await favorites.list(), []);
  assert.deepEqual(await folders.listFolders(), []);
  assert.deepEqual(await recovery.getStatus(), {
    state: "available",
    scopeId: ACCOUNT_A,
    favoriteCount: 6,
    folderCount: 1,
    membershipCount: 1,
  });

  assert.deepEqual(await recovery.restore(ACCOUNT_A), {
    state: "restored",
    favoriteCount: 6,
    folderCount: 1,
    membershipCount: 1,
  });
  assert.equal((await favorites.list()).length, 6);
  assert.equal((await folders.listFolders()).length, 1);
  assert.equal((await folders.listMembership()).length, 1);
  assert.deepEqual(await overrides.get(), { "legacy-folder": "full" });
  assert.deepEqual(await scoped.get(STORAGE_KEYS.uiState, null), { collapsed: true });
  assert.deepEqual(await scoped.get(STORAGE_KEYS.foldersUiState, null), { collapsed: true });
  assert.deepEqual(await scoped.get(STORAGE_KEYS.quickAccessUiState, null), { collapsed: true });
  assert.ok(storageNotifications > 0);

  const retainedBackup = await base.get<LegacyAccountData | null>(
    STORAGE_KEYS.legacyAccountData,
    null,
  );
  assert.equal(retainedBackup?.favorites.length, 6);
  assert.equal(retainedBackup?.claimedToScopeId, ACCOUNT_A);
  assert.equal(typeof retainedBackup?.claimedAt, "number");

  assert.deepEqual(await recovery.restore(ACCOUNT_A), {
    state: "already-claimed",
    claimedToCurrentScope: true,
  });
  assert.equal((await favorites.list()).length, 6);

  const reloadedScope = new AccountScopedStorage(base);
  reloadedScope.setScope(ACCOUNT_A);
  assert.equal((await new FavoritesRepository(reloadedScope).list()).length, 6);
  assert.equal((await new FoldersRepository(reloadedScope).listMembership()).length, 1);

  scoped.setScope(ACCOUNT_B);
  assert.deepEqual(await recovery.restore(ACCOUNT_B), {
    state: "already-claimed",
    claimedToCurrentScope: false,
  });
  assert.deepEqual(await favorites.list(), []);
  unsubscribe();
});

test("restore refuses to overwrite any existing destination organization data", async () => {
  const base = new MemoryStorage();
  await base.set(STORAGE_KEYS.legacyAccountData, createLegacyData());
  const scoped = new AccountScopedStorage(base);
  scoped.setScope(ACCOUNT_A);
  const favorites = new FavoritesRepository(scoped);
  await favorites.add({
    conversationId: "existing-conversation",
    title: "Existing",
    url: "https://chatgpt.com/c/existing-conversation",
  });
  const recovery = new LegacyAccountRecoveryService(base, scoped);

  assert.deepEqual(await recovery.getStatus(), { state: "destination-not-empty" });
  assert.deepEqual(await recovery.restore(ACCOUNT_A), { state: "destination-not-empty" });
  assert.deepEqual(
    (await favorites.list()).map((favorite) => favorite.conversationId),
    ["existing-conversation"],
  );
  const legacy = await base.get<LegacyAccountData | null>(STORAGE_KEYS.legacyAccountData, null);
  assert.equal(legacy?.claimedToScopeId, null);
  assert.equal(legacy?.favorites.length, 6);
});

test("unresolved and logged-out account gates cannot restore legacy data", async () => {
  const base = new MemoryStorage();
  await base.set(STORAGE_KEYS.legacyAccountData, createLegacyData());
  const scoped = new AccountScopedStorage(base);
  const recovery = new LegacyAccountRecoveryService(base, scoped);

  assert.deepEqual(await recovery.getStatus(), { state: "account-unresolved" });
  assert.deepEqual(await recovery.restore(ACCOUNT_A), { state: "account-unresolved" });
  scoped.setScope(ACCOUNT_A);
  scoped.setScope(null);
  assert.deepEqual(await recovery.restore(ACCOUNT_A), { state: "account-unresolved" });
  const legacy = await base.get<LegacyAccountData | null>(STORAGE_KEYS.legacyAccountData, null);
  assert.equal(legacy?.claimedToScopeId, null);
});

test("restore confirmation is bound to the account scope that exposed it", async () => {
  const base = new MemoryStorage();
  await base.set(STORAGE_KEYS.legacyAccountData, createLegacyData());
  const scoped = new AccountScopedStorage(base);
  scoped.setScope(ACCOUNT_A);
  const recovery = new LegacyAccountRecoveryService(base, scoped);
  const status = await recovery.getStatus();
  assert.equal(status.state, "available");

  scoped.setScope(ACCOUNT_B);
  assert.deepEqual(await recovery.restore(ACCOUNT_A), { state: "account-unresolved" });
  assert.deepEqual(await new FavoritesRepository(scoped).list(), []);
  const legacy = await base.get<LegacyAccountData | null>(STORAGE_KEYS.legacyAccountData, null);
  assert.equal(legacy?.claimedToScopeId, null);
});
