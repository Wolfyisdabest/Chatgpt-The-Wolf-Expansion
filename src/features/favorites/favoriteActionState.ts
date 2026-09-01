export type FavoriteActionSurface = "menu" | "debug-current";

export function getFavoriteActionLabel(
  isFavorite: boolean,
  surface: FavoriteActionSurface,
): string {
  if (surface === "debug-current") {
    return isFavorite
      ? "Debug: Remove current chat from Quick Access"
      : "Debug: Add current chat to Quick Access";
  }

  return isFavorite ? "Remove from Quick Access" : "Add to Quick Access";
}
