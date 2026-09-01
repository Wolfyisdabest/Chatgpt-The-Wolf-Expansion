import type { FolderRecord, ItemNameDisplayMode } from "../storage/schemas";

export type FolderChatNameDisplayChoice = ItemNameDisplayMode | "inherit";

export function getFolderChatNameDisplayChoice(
  folderId: string,
  overrides: Readonly<Record<string, ItemNameDisplayMode>>,
): FolderChatNameDisplayChoice {
  return overrides[folderId] ?? "inherit";
}

export function resolveChatNameDisplayMode(
  folderId: string | null,
  folders: readonly FolderRecord[],
  overrides: Readonly<Record<string, ItemNameDisplayMode>>,
  globalDefault: ItemNameDisplayMode,
): ItemNameDisplayMode {
  if (folderId === null) {
    return globalDefault;
  }
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visited = new Set<string>();
  let currentId: string | null = folderId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const override = overrides[currentId];
    if (override === "compact" || override === "full") {
      return override;
    }
    currentId = byId.get(currentId)?.parentId ?? null;
  }
  return globalDefault;
}

export function pruneFolderChatNameDisplayOverrides(
  overrides: Readonly<Record<string, ItemNameDisplayMode>>,
  validFolderIds: ReadonlySet<string>,
): Record<string, ItemNameDisplayMode> {
  const retained: Record<string, ItemNameDisplayMode> = {};
  for (const [folderId, mode] of Object.entries(overrides)) {
    if (validFolderIds.has(folderId) && (mode === "compact" || mode === "full")) {
      retained[folderId] = mode;
    }
  }
  return retained;
}
