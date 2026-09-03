import type { ItemNameDisplayMode } from "../../storage/schemas";

export interface ItemNamePresentation {
  autoRevealOverflow: boolean;
  maxVisibleLines: 1 | 2;
  overflowStyle: "fade";
  singleLine: boolean;
}

export interface ItemNameOverflowState {
  fadeVisible: boolean;
  overflowing: boolean;
  revealMetrics: OverflowRevealMetrics | null;
}

export interface ItemNameSemantics {
  accessibleName: string;
  tooltip: string;
  visibleText: string;
}

export interface OverflowRevealMetrics {
  distancePixels: number;
  durationSeconds: number;
}

export type ItemNameRevealPhase = "idle" | "revealing" | "returning";

export interface ItemNameRevealPresentation {
  controlsSuppressed: boolean;
  fadeVisible: boolean;
  usesFullWidth: boolean;
  translatePixels: number;
}

export interface ItemNameReadableViewport {
  clientWidth: number;
  clipLeftPixels: number;
  clipRightPixels: number;
  inlineEndOcclusion: number;
}

export const ITEM_NAME_REVEAL_DELAY_MS = 450;
export const ITEM_NAME_RESET_DURATION_MS = 180;

export function getItemNamePresentation(
  mode: ItemNameDisplayMode,
): ItemNamePresentation {
  return mode === "full"
    ? {
        autoRevealOverflow: false,
        maxVisibleLines: 2,
        overflowStyle: "fade",
        singleLine: false,
      }
    : {
        autoRevealOverflow: true,
        maxVisibleLines: 1,
        overflowStyle: "fade",
        singleLine: true,
      };
}

export function getItemNameOverflowState(
  scrollWidth: number,
  clientWidth: number,
  reducedMotion: boolean,
): ItemNameOverflowState {
  const overflowing = clientWidth > 0 && scrollWidth - clientWidth > 1;
  return {
    fadeVisible: overflowing,
    overflowing,
    revealMetrics: overflowing
      ? getOverflowRevealMetrics(scrollWidth, clientWidth, reducedMotion)
      : null,
  };
}

export function getItemNameSemantics(value: string): ItemNameSemantics {
  return {
    accessibleName: value,
    tooltip: value,
    visibleText: value,
  };
}

export function getOverflowRevealMetrics(
  scrollWidth: number,
  clientWidth: number,
  reducedMotion: boolean,
): OverflowRevealMetrics | null {
  const distancePixels = scrollWidth - clientWidth;
  if (reducedMotion || distancePixels <= 1 || clientWidth <= 0) {
    return null;
  }
  return {
    distancePixels,
    durationSeconds: Math.min(12, Math.max(2.5, distancePixels / 32)),
  };
}

export function getUnobscuredItemNameWidth(
  clientWidth: number,
  inlineEndOcclusion: number,
): number {
  return Math.max(0, clientWidth - Math.max(0, inlineEndOcclusion));
}

export function getItemNameRevealWidth(
  fullClientWidth: number,
  idleInlineEndOcclusion: number,
  revealActive: boolean,
): number {
  return revealActive
    ? Math.max(0, fullClientWidth)
    : getUnobscuredItemNameWidth(fullClientWidth, idleInlineEndOcclusion);
}

export function getItemNameReadableViewport(
  clientWidth: number,
  viewportStart: number,
  viewportEnd: number,
  controlsStart: number,
  controlsEnd: number,
  direction: "ltr" | "rtl",
): ItemNameReadableViewport {
  const inlineEndOcclusion = direction === "rtl"
    ? Math.max(0, controlsEnd - viewportStart)
    : Math.max(0, viewportEnd - controlsStart);
  const boundedOcclusion = Math.min(Math.max(0, clientWidth), inlineEndOcclusion);
  return {
    clientWidth: getUnobscuredItemNameWidth(clientWidth, boundedOcclusion),
    clipLeftPixels: direction === "rtl" ? boundedOcclusion : 0,
    clipRightPixels: direction === "rtl" ? 0 : boundedOcclusion,
    inlineEndOcclusion: boundedOcclusion,
  };
}

export function getItemNameRevealPresentation(
  scrollWidth: number,
  clientWidth: number,
  reducedMotion: boolean,
  phase: ItemNameRevealPhase,
): ItemNameRevealPresentation {
  const overflowState = getItemNameOverflowState(
    scrollWidth,
    clientWidth,
    reducedMotion,
  );
  const effectivePhase = overflowState.revealMetrics ? phase : "idle";
  return {
    controlsSuppressed: effectivePhase !== "idle",
    fadeVisible: overflowState.overflowing && effectivePhase === "idle",
    usesFullWidth: effectivePhase !== "idle",
    translatePixels: effectivePhase === "revealing"
      ? overflowState.revealMetrics?.distancePixels ?? 0
      : 0,
  };
}
