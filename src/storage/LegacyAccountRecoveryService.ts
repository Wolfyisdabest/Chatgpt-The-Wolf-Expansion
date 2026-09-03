import {
  ACCOUNT_OWNED_STORAGE_KEYS,
  AccountScopedStorage,
  getAccountScopedStorageKey,
} from "./AccountScopedStorage";
import {
  hasLegacyOrganizationData,
  normalizeLegacyAccountData,
} from "./migrations";
import { STORAGE_KEYS, type LegacyAccountData } from "./schemas";
import type { KeyValueStorage } from "./StorageService";

export type LegacyAccountRecoveryStatus =
  | { state: "account-unresolved" }
  | { state: "no-legacy-data" }
  | { state: "already-claimed"; claimedToCurrentScope: boolean }
  | { state: "destination-not-empty" }
  | {
      state: "available";
      scopeId: string;
      favoriteCount: number;
      folderCount: number;
      membershipCount: number;
    };

export type LegacyAccountRecoveryResult =
  | Exclude<LegacyAccountRecoveryStatus, { state: "available" }>
  | {
      state: "restored";
      favoriteCount: number;
      folderCount: number;
      membershipCount: number;
    };

export class LegacyAccountRecoveryService {
  private operationQueue: Promise<void> = Promise.resolve();

  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly accountStorage: AccountScopedStorage,
  ) {}

  public async getStatus(): Promise<LegacyAccountRecoveryStatus> {
    const scopeId = this.accountStorage.activeScopeId;
    return scopeId ? this.inspectForScope(scopeId) : { state: "account-unresolved" };
  }

  public async restore(expectedScopeId: string): Promise<LegacyAccountRecoveryResult> {
    let result: LegacyAccountRecoveryResult = { state: "account-unresolved" };
    const operation = async (): Promise<void> => {
      const scopeId = this.accountStorage.activeScopeId;
      if (!scopeId || scopeId !== expectedScopeId) {
        result = { state: "account-unresolved" };
        return;
      }
      const status = await this.inspectForScope(scopeId);
      if (status.state !== "available") {
        result = status;
        return;
      }
      if (this.accountStorage.activeScopeId !== scopeId) {
        result = { state: "account-unresolved" };
        return;
      }
      const legacy = await this.readLegacy();
      if (!legacy || !hasLegacyOrganizationData(legacy)) {
        result = { state: "no-legacy-data" };
        return;
      }
      if (legacy.claimedToScopeId) {
        result = {
          state: "already-claimed",
          claimedToCurrentScope: legacy.claimedToScopeId === scopeId,
        };
        return;
      }
      if (await this.destinationHasData(scopeId)) {
        result = { state: "destination-not-empty" };
        return;
      }
      if (this.accountStorage.activeScopeId !== scopeId) {
        result = { state: "account-unresolved" };
        return;
      }

      const claimedAt = Date.now();
      const claimedLegacy: LegacyAccountData = {
        preservedAt: legacy.preservedAt,
        sourceSchemaVersion: legacy.sourceSchemaVersion,
        claimedToScopeId: scopeId,
        claimedAt,
        favorites: legacy.favorites,
        uiState: legacy.uiState,
        folders: legacy.folders,
        folderMembership: legacy.folderMembership,
        foldersUiState: legacy.foldersUiState,
        quickAccessUiState: legacy.quickAccessUiState,
        folderChatNameDisplayOverrides: legacy.folderChatNameDisplayOverrides,
      };
      await this.storage.setMany({
        [getAccountScopedStorageKey(scopeId, STORAGE_KEYS.favorites)]: legacy.favorites,
        [getAccountScopedStorageKey(scopeId, STORAGE_KEYS.uiState)]: legacy.uiState,
        [getAccountScopedStorageKey(scopeId, STORAGE_KEYS.folders)]: legacy.folders,
        [getAccountScopedStorageKey(scopeId, STORAGE_KEYS.folderMembership)]: legacy.folderMembership,
        [getAccountScopedStorageKey(scopeId, STORAGE_KEYS.foldersUiState)]: legacy.foldersUiState,
        [getAccountScopedStorageKey(scopeId, STORAGE_KEYS.quickAccessUiState)]: legacy.quickAccessUiState,
        [getAccountScopedStorageKey(
          scopeId,
          STORAGE_KEYS.folderChatNameDisplayOverrides,
        )]: legacy.folderChatNameDisplayOverrides,
        [STORAGE_KEYS.legacyAccountData]: claimedLegacy,
      });
      result = {
        state: "restored",
        favoriteCount: legacy.favorites.length,
        folderCount: legacy.folders.length,
        membershipCount: legacy.folderMembership.length,
      };
    };
    const nextOperation = this.operationQueue.then(operation, operation);
    this.operationQueue = nextOperation.catch(() => undefined);
    await nextOperation;
    return result;
  }

  private async inspectForScope(scopeId: string): Promise<LegacyAccountRecoveryStatus> {
    if (this.accountStorage.activeScopeId !== scopeId) {
      return { state: "account-unresolved" };
    }
    const legacy = await this.readLegacy();
    if (!legacy || !hasLegacyOrganizationData(legacy)) {
      return { state: "no-legacy-data" };
    }
    if (legacy.claimedToScopeId) {
      return {
        state: "already-claimed",
        claimedToCurrentScope: legacy.claimedToScopeId === scopeId,
      };
    }
    if (await this.destinationHasData(scopeId)) {
      return { state: "destination-not-empty" };
    }
    if (this.accountStorage.activeScopeId !== scopeId) {
      return { state: "account-unresolved" };
    }
    return {
      state: "available",
      scopeId,
      favoriteCount: legacy.favorites.length,
      folderCount: legacy.folders.length,
      membershipCount: legacy.folderMembership.length,
    };
  }

  private async readLegacy(): Promise<LegacyAccountData | null> {
    return normalizeLegacyAccountData(
      await this.storage.get<unknown>(STORAGE_KEYS.legacyAccountData, undefined),
    );
  }

  private async destinationHasData(scopeId: string): Promise<boolean> {
    const values = await Promise.all(
      ACCOUNT_OWNED_STORAGE_KEYS.map((key) =>
        this.storage.get<unknown>(getAccountScopedStorageKey(scopeId, key), undefined)
      ),
    );
    return values.some((value) => value !== undefined);
  }
}
