export type SidebarSectionKind = "pinned" | "history" | "other";
export type WolfSidebarSlot = "settings" | "quick-access";

export const WOLF_SIDEBAR_SLOT_ORDER: readonly WolfSidebarSlot[] = [
  "settings",
  "quick-access",
];

export function getWolfRootInsertionIndex(
  sections: readonly SidebarSectionKind[],
): number {
  const pinnedIndex = sections.indexOf("pinned");
  if (pinnedIndex >= 0) {
    return pinnedIndex;
  }
  const historyIndex = sections.indexOf("history");
  return historyIndex >= 0 ? historyIndex : sections.length;
}

export function getWolfSlotInsertionIndex(
  existingSlots: readonly WolfSidebarSlot[],
  slot: WolfSidebarSlot,
): number {
  const requestedOrder = WOLF_SIDEBAR_SLOT_ORDER.indexOf(slot);
  const nextSlotIndex = existingSlots.findIndex(
    (existing) => WOLF_SIDEBAR_SLOT_ORDER.indexOf(existing) > requestedOrder,
  );
  return nextSlotIndex >= 0 ? nextSlotIndex : existingSlots.length;
}

export function projectCanonicalSidebarOrder(
  nativeSections: readonly SidebarSectionKind[],
  wolfSlots: readonly WolfSidebarSlot[] = WOLF_SIDEBAR_SLOT_ORDER,
): Array<SidebarSectionKind | WolfSidebarSlot> {
  const insertionIndex = getWolfRootInsertionIndex(nativeSections);
  const orderedSlots = WOLF_SIDEBAR_SLOT_ORDER.filter((slot) =>
    wolfSlots.includes(slot));
  return [
    ...nativeSections.slice(0, insertionIndex),
    ...orderedSlots,
    ...nativeSections.slice(insertionIndex),
  ];
}
