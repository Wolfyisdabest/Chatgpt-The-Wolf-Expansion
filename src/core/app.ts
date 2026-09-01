import { DefaultChatGPTAdapter } from "../adapters/chatgpt/ChatGPTAdapter";
import { FavoritesRepository } from "../features/favorites/FavoritesRepository";
import { FoldersRepository } from "../features/folders/FoldersRepository";
import { QuickAccessFeature } from "../features/quickAccess/QuickAccessFeature";
import { QuickAccessUiStateRepository } from "../features/quickAccess/QuickAccessUiStateRepository";
import { InChatSettingsFeature } from "../features/settings/InChatSettingsFeature";
import { SettingsService } from "../settings/settings";
import { migrateStorage } from "../storage/migrations";
import { StorageService } from "../storage/StorageService";
import type { Unsubscribe } from "../shared/types";
import { FeatureLifecycle } from "./lifecycle";
import { ConsoleLogger } from "./logger";
import { WolfSidebarRoot } from "./WolfSidebarRoot";

export class WolfExpansionApp {
  private readonly logger = new ConsoleLogger(false);
  private readonly storage = new StorageService(this.logger);
  private readonly settingsService = new SettingsService(this.storage);
  private readonly lifecycle = new FeatureLifecycle();
  private readonly adapter = new DefaultChatGPTAdapter(this.logger);
  private readonly sidebarRoot = new WolfSidebarRoot(this.adapter, this.logger);
  private readonly favoritesRepository = new FavoritesRepository(this.storage, this.logger);
  private readonly foldersRepository = new FoldersRepository(this.storage, this.logger);
  private readonly quickAccessUiStateRepository = new QuickAccessUiStateRepository(this.storage);
  private readonly settingsFeature = new InChatSettingsFeature(
    this.adapter,
    this.settingsService,
    this.foldersRepository,
    this.sidebarRoot,
    this.logger,
  );
  private readonly quickAccessFeature = new QuickAccessFeature(
    this.adapter,
    this.favoritesRepository,
    this.foldersRepository,
    this.quickAccessUiStateRepository,
    this.settingsService,
    this.sidebarRoot,
    this.logger,
  );
  private settingsUnsubscribe: Unsubscribe | null = null;
  private applyingSettings: Promise<void> = Promise.resolve();

  public async start(): Promise<void> {
    await migrateStorage(this.storage);
    await this.applySettings();
    this.settingsUnsubscribe = this.settingsService.subscribe(() => {
      this.applyingSettings = this.applyingSettings.then(
        () => this.applySettings(),
        () => this.applySettings(),
      );
    });
    this.logger.debug("Extension initialized.");
  }

  public async destroy(): Promise<void> {
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
    await this.lifecycle.destroy([
      this.quickAccessFeature,
      this.settingsFeature,
    ]);
    this.sidebarRoot.destroy();
  }

  private async applySettings(): Promise<void> {
    const settings = await this.settingsService.get();
    this.logger.setDebugEnabled(settings.debug.enabled);

    if (!settings.enabled) {
      await this.lifecycle.setEnabled(this.quickAccessFeature, false);
      await this.lifecycle.setEnabled(this.settingsFeature, false);
      this.settingsFeature.setSettings(settings);
      await this.quickAccessFeature.setSettings(settings);
      return;
    }

    if (!settings.favorites.enabled) {
      await this.lifecycle.setEnabled(this.quickAccessFeature, false);
    }
    this.settingsFeature.setSettings(settings);
    await this.quickAccessFeature.setSettings(settings);
    await this.lifecycle.setEnabled(this.settingsFeature, true);
    await this.lifecycle.setEnabled(
      this.quickAccessFeature,
      settings.favorites.enabled,
    );
  }
}
