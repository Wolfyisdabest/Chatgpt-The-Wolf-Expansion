import type { Feature } from "../shared/types";

export class FeatureLifecycle {
  private readonly enabledFeatures = new Set<string>();

  public async setEnabled(feature: Feature, enabled: boolean): Promise<void> {
    const isEnabled = this.enabledFeatures.has(feature.id);

    if (enabled && !isEnabled) {
      await feature.enable();
      this.enabledFeatures.add(feature.id);
    } else if (!enabled && isEnabled) {
      await feature.disable();
      this.enabledFeatures.delete(feature.id);
    }
  }

  public async destroy(features: readonly Feature[]): Promise<void> {
    for (const feature of features) {
      await feature.destroy();
      this.enabledFeatures.delete(feature.id);
    }
  }
}
