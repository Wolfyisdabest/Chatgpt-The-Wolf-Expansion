import type { ItemNameDisplayMode } from "../../storage/schemas";

export interface ItemNamePresentation {
  autoRevealOverflow: boolean;
  singleLine: boolean;
}

export interface OverflowRevealMetrics {
  distancePixels: number;
  durationSeconds: number;
}

export function getItemNamePresentation(
  mode: ItemNameDisplayMode,
): ItemNamePresentation {
  return mode === "full"
    ? { autoRevealOverflow: false, singleLine: false }
    : { autoRevealOverflow: true, singleLine: true };
}

export function getOverflowRevealMetrics(
  scrollWidth: number,
  clientWidth: number,
  reducedMotion: boolean,
): OverflowRevealMetrics | null {
  const distancePixels = Math.ceil(scrollWidth - clientWidth);
  if (reducedMotion || distancePixels <= 1 || clientWidth <= 0) {
    return null;
  }
  return {
    distancePixels,
    durationSeconds: Math.min(12, Math.max(2.5, distancePixels / 32)),
  };
}
