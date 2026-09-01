import { normalizeQuickAccessUiState } from "../../storage/migrations";
import {
  STORAGE_KEYS,
  type QuickAccessUiState,
} from "../../storage/schemas";
import type { KeyValueStorage } from "../../storage/StorageService";

export class QuickAccessUiStateRepository {
  public constructor(private readonly storage: KeyValueStorage) {}

  public async get(): Promise<QuickAccessUiState> {
    return normalizeQuickAccessUiState(
      await this.storage.get<unknown>(STORAGE_KEYS.quickAccessUiState, { collapsed: false }),
    );
  }

  public async save(state: QuickAccessUiState): Promise<void> {
    await this.storage.set(STORAGE_KEYS.quickAccessUiState, normalizeQuickAccessUiState(state));
  }
}
