export type QuickAccessRefreshReason = "explicit" | "repository" | "sidebar";

export interface QuickAccessRefreshWork {
  generation: number;
  ingestDetectedTitles: boolean;
}

export class QuickAccessRefreshCoordinator {
  private latestGeneration = 0;
  private pending = false;
  private pendingTitleIngestion = false;

  public request(reason: QuickAccessRefreshReason): number {
    this.latestGeneration += 1;
    this.pending = true;
    if (reason !== "repository") {
      this.pendingTitleIngestion = true;
    }
    return this.latestGeneration;
  }

  public takeNext(): QuickAccessRefreshWork | null {
    if (!this.pending) {
      return null;
    }
    const work = {
      generation: this.latestGeneration,
      ingestDetectedTitles: this.pendingTitleIngestion,
    };
    this.pending = false;
    this.pendingTitleIngestion = false;
    return work;
  }

  public isLatest(generation: number): boolean {
    return generation === this.latestGeneration;
  }

  public reset(): void {
    this.pending = false;
    this.pendingTitleIngestion = false;
  }
}
