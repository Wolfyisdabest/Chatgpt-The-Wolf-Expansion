const CHATGPT_ORIGIN = "https://chatgpt.com";
const MAX_CONVERSATION_ID_LENGTH = 256;

export function parseConversationId(
  url: string,
  baseUrl: string = `${CHATGPT_ORIGIN}/`,
): string | null {
  try {
    const parsedUrl = new URL(url, baseUrl);
    if (parsedUrl.origin !== CHATGPT_ORIGIN) {
      return null;
    }

    const match = /^\/c\/([^/?#]+)\/?$/u.exec(parsedUrl.pathname);
    if (!match?.[1]) {
      return null;
    }

    const conversationId = decodeURIComponent(match[1]);
    if (
      conversationId.length === 0 ||
      conversationId.length > MAX_CONVERSATION_ID_LENGTH ||
      /[\s/?#]/u.test(conversationId)
    ) {
      return null;
    }

    return conversationId;
  } catch {
    return null;
  }
}

export function createConversationUrl(conversationId: string): string {
  return `${CHATGPT_ORIGIN}/c/${encodeURIComponent(conversationId)}`;
}
