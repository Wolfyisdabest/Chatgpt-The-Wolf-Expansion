import type { Unsubscribe } from "../../shared/types";
import { normalizeFolderChatNameDisplayOverrides } from "../../storage/migrations";
import { STORAGE_KEYS, type ItemNameDisplayMode } from "../../storage/schemas";
import type { KeyValueStorage } from "../../storage/StorageService";

export class FolderDisplayOverridesRepository {
  private operationQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly storage: KeyValueStorage) {}

  public async get(): Promise<Record<string, ItemNameDisplayMode>> {
    return normalizeFolderChatNameDisplayOverrides(
      await this.storage.get<unknown>(STORAGE_KEYS.folderChatNameDisplayOverrides, {}),
    );
  }

  public async set(folderId: string, mode: ItemNameDisplayMode | null): Promise<void> {
    const normalizedFolderId = folderId.trim();
    if (!normalizedFolderId) {
      return;
    }
    await this.enqueue(async () => {
      const overrides = await this.get();
      if (mode === null) {
        delete overrides[normalizedFolderId];
      } else {
        overrides[normalizedFolderId] = mode;
      }
      await this.storage.set(STORAGE_KEYS.folderChatNameDisplayOverrides, overrides);
    });
  }

  public subscribe(listener: () => void): Unsubscribe {
    return this.storage.subscribe(STORAGE_KEYS.folderChatNameDisplayOverrides, listener);
  }

  public async whenIdle(): Promise<void> {
    await this.operationQueue;
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.operationQueue.then(operation, operation);
    this.operationQueue = next.catch(() => undefined);
    await next;
  }
}
