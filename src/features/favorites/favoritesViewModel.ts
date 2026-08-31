import type { FavoriteConversation } from "../../storage/schemas";

export interface FavoriteListItemView {
  conversationId: string;
  title: string;
  url: string;
}

export function createFavoriteListView(
  favorites: readonly FavoriteConversation[],
): FavoriteListItemView[] {
  return favorites.map(({ conversationId, title, url }) => ({
    conversationId,
    title,
    url,
  }));
}
