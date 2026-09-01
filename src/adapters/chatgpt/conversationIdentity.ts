import { createConversationUrl, parseConversationId } from "./conversationUrl";

export interface ConversationIdentityInput {
  conversationId?: unknown;
  title?: unknown;
  url?: unknown;
}

export interface NormalizedConversationIdentity {
  conversationId: string;
  title: string;
  url: string;
}

export type ConversationIdentityNormalizationResult =
  | { ok: true; conversation: NormalizedConversationIdentity; titleResolved: boolean }
  | { ok: false; reason: string };

const FALLBACK_CONVERSATION_TITLE = "Untitled conversation";

export function sanitizeConversationTitle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^pinned\s*[:,]\s*/iu, "")
    .replace(/\s*(?:[-–—]\s*pinned|\(\s*pinned\s*\)|\[\s*(?:openai\s*)?pin(?:ned)?\s*\])\s*$/iu, "")
    .replace(/^pinned$/iu, "")
    .trim();
}

export function normalizeConversationIdentity(
  input: ConversationIdentityInput,
): ConversationIdentityNormalizationResult {
  if (typeof input.conversationId !== "string" || !input.conversationId.trim()) {
    return { ok: false, reason: "conversationId is missing or empty" };
  }

  const conversationId = input.conversationId.trim();
  const normalizedUrl = createConversationUrl(conversationId);
  if (parseConversationId(normalizedUrl) !== conversationId) {
    return { ok: false, reason: "conversationId is not safe for a ChatGPT conversation URL" };
  }

  if (typeof input.url !== "string" || parseConversationId(input.url) !== conversationId) {
    return { ok: false, reason: "URL is missing, invalid, or belongs to another conversation" };
  }

  const resolvedTitle = sanitizeConversationTitle(input.title);
  return {
    ok: true,
    conversation: {
      conversationId,
      title: resolvedTitle || FALLBACK_CONVERSATION_TITLE,
      url: normalizedUrl,
    },
    titleResolved: resolvedTitle.length > 0,
  };
}
