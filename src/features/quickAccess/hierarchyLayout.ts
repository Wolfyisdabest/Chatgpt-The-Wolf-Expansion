import type { WolfIconName } from "../../shared/icons";

export type QuickAccessHierarchyItemKind = "folder" | "chat";

export interface QuickAccessHierarchyLayout {
  logicalDepth: number;
  visualDepth: number;
}

export interface ChevronPresentation {
  direction: "right" | "down";
  icon: Extract<WolfIconName, "chevron-right">;
}

export function getQuickAccessHierarchyLayout(
  logicalDepth: number,
  _kind: QuickAccessHierarchyItemKind,
): QuickAccessHierarchyLayout {
  const safeDepth = Number.isInteger(logicalDepth) && logicalDepth >= 0
    ? logicalDepth
    : 0;
  return {
    logicalDepth: safeDepth,
    visualDepth: safeDepth + 1,
  };
}

export function getChevronPresentation(expanded: boolean): ChevronPresentation {
  return {
    direction: expanded ? "down" : "right",
    icon: "chevron-right",
  };
}
