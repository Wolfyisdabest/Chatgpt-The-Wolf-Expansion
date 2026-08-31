export type FavoriteActionSurface = "menu" | "debug-current";

export function getFavoriteActionLabel(
  isFavorite: boolean,
  surface: FavoriteActionSurface,
): string {
  if (surface === "debug-current") {
    return isFavorite
      ? "Debug: Unfavorite current chat"
      : "Debug: Favorite current chat";
  }

  return isFavorite ? "★ Remove from Favorites" : "⭐ Add to Favorites";
}
