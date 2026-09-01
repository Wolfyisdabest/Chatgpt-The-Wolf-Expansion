import "./options.css";
import { SettingsService } from "../settings";
import { migrateStorage } from "../../storage/migrations";
import { StorageService } from "../../storage/StorageService";
import { FoldersRepository } from "../../features/folders/FoldersRepository";
import type { FolderRecord, ItemNameDisplayMode, WolfExpansionSettings } from "../../storage/schemas";

function requireCheckbox(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") {
    throw new Error(`Missing checkbox: ${id}`);
  }
  return element;
}

function requireSelect(id: string): HTMLSelectElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Missing select: ${id}`);
  }
  return element;
}

async function initializeOptions(): Promise<void> {
  const storage = new StorageService();
  const settingsService = new SettingsService(storage);
  const foldersRepository = new FoldersRepository(storage);
  await migrateStorage(storage);

  const form = document.getElementById("settings-form");
  const status = document.getElementById("status");
  if (!(form instanceof HTMLFormElement) || !status) {
    throw new Error("The settings page markup is incomplete.");
  }

  const enabled = requireCheckbox("enabled");
  const debugEnabled = requireCheckbox("debug-enabled");
  const favoritesEnabled = requireCheckbox("favorites-enabled");
  const showIcon = requireCheckbox("favorites-show-icon");
  const rememberCollapsed = requireCheckbox("favorites-remember-collapsed");
  const itemNameDisplay = requireSelect("favorites-item-name-display");
  const foldersEnabled = requireCheckbox("folders-enabled");
  const foldersRememberCollapsed = requireCheckbox("folders-remember-collapsed");
  const foldersShowIcons = requireCheckbox("folders-show-icons");
  const folderOverridesToggle = document.getElementById("folder-overrides-toggle");
  const folderOverridesContent = document.getElementById("folder-overrides-content");
  if (!(folderOverridesToggle instanceof HTMLButtonElement) || !folderOverridesContent) {
    throw new Error("The folder override manager markup is incomplete.");
  }
  let currentSettings: WolfExpansionSettings | null = null;
  const renderFolderOverrides = async (): Promise<void> => {
    if (folderOverridesContent.hidden || !currentSettings) {
      return;
    }
    const folders = await foldersRepository.listFolders();
    folderOverridesContent.replaceChildren();
    if (folders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "folder-overrides-empty";
      empty.textContent = "No folders yet.";
      folderOverridesContent.append(empty);
      return;
    }
    if (Object.keys(currentSettings.folders.chatNameDisplayOverrides).length === 0) {
      const inherited = document.createElement("p");
      inherited.className = "folder-overrides-empty";
      inherited.textContent = "All folders currently inherit the default.";
      folderOverridesContent.append(inherited);
    }
    for (const { folder, depth } of flattenFolders(folders)) {
      const row = document.createElement("label");
      row.className = "folder-override-row";
      row.style.setProperty("--folder-settings-depth", String(depth));
      const name = document.createElement("span");
      name.textContent = folder.name;
      name.title = folder.name;
      const select = createFolderOverrideSelect(folder, currentSettings);
      select.addEventListener("change", (event) => {
        event.stopPropagation();
        const mode: ItemNameDisplayMode | null = select.value === "compact" || select.value === "full"
          ? select.value
          : null;
        void settingsService.setFolderChatNameDisplay(folder.id, mode).then((settings) => {
          currentSettings = settings;
          status.textContent = "Folder display override saved.";
          return renderFolderOverrides();
        }).catch((error: unknown) => {
          console.error("[Wolf Expansion] Could not save folder display override.", error);
          status.textContent = "Could not save folder display override.";
        });
      });
      row.append(name, select);
      folderOverridesContent.append(row);
    }
  };
  folderOverridesToggle.addEventListener("click", () => {
    const open = folderOverridesContent.hidden;
    folderOverridesContent.hidden = !open;
    folderOverridesToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      void renderFolderOverrides();
    }
  });
  const renderSettings = async (): Promise<void> => {
    const settings = await settingsService.get();
    currentSettings = settings;
    enabled.checked = settings.enabled;
    debugEnabled.checked = settings.debug.enabled;
    favoritesEnabled.checked = settings.favorites.enabled;
    showIcon.checked = settings.favorites.showIcon;
    rememberCollapsed.checked = settings.favorites.rememberCollapsed;
    itemNameDisplay.value = settings.favorites.itemNameDisplay;
    foldersEnabled.checked = settings.folders.enabled;
    foldersRememberCollapsed.checked = settings.folders.rememberCollapsed;
    foldersShowIcons.checked = settings.folders.showIcons;
    await renderFolderOverrides();
  };
  await renderSettings();

  const unsubscribe = settingsService.subscribe(() => {
    void renderSettings().catch((error: unknown) => {
      console.error("[Wolf Expansion] Could not synchronize settings.", error);
    });
  });
  const unsubscribeFolders = foldersRepository.subscribe(() => {
    void renderFolderOverrides();
  });
  window.addEventListener("unload", () => {
    unsubscribe();
    unsubscribeFolders();
  }, { once: true });

  form.addEventListener("change", async () => {
    try {
      await settingsService.update({
        enabled: enabled.checked,
        debug: {
          enabled: debugEnabled.checked,
        },
        favorites: {
          enabled: favoritesEnabled.checked,
          showIcon: showIcon.checked,
          rememberCollapsed: rememberCollapsed.checked,
          itemNameDisplay: itemNameDisplay.value === "full" ? "full" : "compact",
        },
        folders: {
          enabled: foldersEnabled.checked,
          rememberCollapsed: foldersRememberCollapsed.checked,
          showIcons: foldersShowIcons.checked,
        },
      });
      status.textContent = "Settings saved.";
    } catch (error) {
      console.error("[Wolf Expansion] Could not save settings.", error);
      status.textContent = "Could not save settings.";
    }
  });
}

function createFolderOverrideSelect(
  folder: FolderRecord,
  settings: WolfExpansionSettings,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.setAttribute("aria-label", `Chat name display for ${folder.name}`);
  for (const [value, label] of [
    ["inherit", "Inherit"],
    ["compact", "Compact"],
    ["full", "Full"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  select.value = settings.folders.chatNameDisplayOverrides[folder.id] ?? "inherit";
  return select;
}

function flattenFolders(
  folders: readonly FolderRecord[],
): Array<{ folder: FolderRecord; depth: number }> {
  const byParent = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) => left.sortIndex - right.sortIndex || left.createdAt - right.createdAt);
  }
  const flattened: Array<{ folder: FolderRecord; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number): void => {
    for (const folder of byParent.get(parentId) ?? []) {
      if (visited.has(folder.id)) {
        continue;
      }
      visited.add(folder.id);
      flattened.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return flattened;
}

void initializeOptions().catch((error: unknown) => {
  console.error("[Wolf Expansion] Could not load settings.", error);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "Could not load settings.";
  }
});
