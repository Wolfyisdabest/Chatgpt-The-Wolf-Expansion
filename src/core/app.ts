import { DefaultChatGPTAdapter } from "../adapters/chatgpt/ChatGPTAdapter";
import { FavoritesFeature } from "../features/favorites/FavoritesFeature";
import { FavoritesRepository } from "../features/favorites/FavoritesRepository";
import { InChatSettingsFeature } from "../features/settings/InChatSettingsFeature";
import { SettingsService } from "../settings/settings";
import { migrateStorage } from "../storage/migrations";
import { StorageService } from "../storage/StorageService";
import type { Unsubscribe } from "../shared/types";
import { FeatureLifecycle } from "./lifecycle";
import { ConsoleLogger } from "./logger";

export class WolfExpansionApp {
  private readonly logger = new ConsoleLogger(false);
  private readonly storage = new StorageService(this.logger);
  private readonly settingsService = new SettingsService(this.storage);
  private readonly lifecycle = new FeatureLifecycle();
  private readonly adapter = new DefaultChatGPTAdapter(this.logger);
  private readonly favoritesRepository = new FavoritesRepository(this.storage, this.logger);
  private readonly settingsFeature = new InChatSettingsFeature(
    this.adapter,
    this.settingsService,
    this.logger,
  );
  private readonly favoritesFeature = new FavoritesFeature(
    this.adapter,
    this.favoritesRepository,
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
    await this.lifecycle.destroy([this.favoritesFeature, this.settingsFeature]);
  }

  private async applySettings(): Promise<void> {
    const settings = await this.settingsService.get();
    this.logger.setDebugEnabled(settings.debug.enabled);

    if (!settings.enabled) {
      await this.lifecycle.setEnabled(this.favoritesFeature, false);
      await this.lifecycle.setEnabled(this.settingsFeature, false);
      this.settingsFeature.setSettings(settings);
      await this.favoritesFeature.setSettings(settings);
      return;
    }

    if (!settings.favorites.enabled) {
      await this.lifecycle.setEnabled(this.favoritesFeature, false);
    }
    this.settingsFeature.setSettings(settings);
    await this.favoritesFeature.setSettings(settings);
    await this.lifecycle.setEnabled(this.settingsFeature, true);
    await this.lifecycle.setEnabled(this.favoritesFeature, settings.favorites.enabled);
  }
}
