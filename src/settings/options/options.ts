import "./options.css";
import { SettingsService } from "../settings";
import { migrateStorage } from "../../storage/migrations";
import { StorageService } from "../../storage/StorageService";

function requireCheckbox(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") {
    throw new Error(`Missing checkbox: ${id}`);
  }
  return element;
}

async function initializeOptions(): Promise<void> {
  const storage = new StorageService();
  const settingsService = new SettingsService(storage);
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
  const renderSettings = async (): Promise<void> => {
    const settings = await settingsService.get();
    enabled.checked = settings.enabled;
    debugEnabled.checked = settings.debug.enabled;
    favoritesEnabled.checked = settings.favorites.enabled;
    showIcon.checked = settings.favorites.showIcon;
    rememberCollapsed.checked = settings.favorites.rememberCollapsed;
  };
  await renderSettings();

  const unsubscribe = settingsService.subscribe(() => {
    void renderSettings().catch((error: unknown) => {
      console.error("[Wolf Expansion] Could not synchronize settings.", error);
    });
  });
  window.addEventListener("unload", unsubscribe, { once: true });

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
        },
      });
      status.textContent = "Settings saved.";
    } catch (error) {
      console.error("[Wolf Expansion] Could not save settings.", error);
      status.textContent = "Could not save settings.";
    }
  });
}

void initializeOptions().catch((error: unknown) => {
  console.error("[Wolf Expansion] Could not load settings.", error);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "Could not load settings.";
  }
});
