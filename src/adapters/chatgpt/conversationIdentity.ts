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

export interface ConversationTitleCandidates {
  visibleText?: unknown;
  textContentFallback?: unknown;
  ariaLabel?: unknown;
  titleAttribute?: unknown;
}

export type ConversationTitleSource =
  | "aria-label"
  | "none"
  | "text-content-fallback"
  | "title-attribute"
  | "visible-text";

export interface SelectedConversationTitle {
  source: ConversationTitleSource;
  title: string;
}

export interface DetectedConversationIdentityInput extends ConversationIdentityInput {
  titleResolved: boolean;
}

export interface DetectedConversationMetadata {
  title: string;
  url: string;
}

const FALLBACK_CONVERSATION_TITLE = "Untitled conversation";

export function normalizeConversationTitle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/gu, " ").trim();
}

export function selectConversationTitle(
  candidates: ConversationTitleCandidates,
): string {
  return selectConversationTitleWithSource(candidates).title;
}

export function selectConversationTitleWithSource(
  candidates: ConversationTitleCandidates,
): SelectedConversationTitle {
  const visibleText = normalizeConversationTitle(candidates.visibleText);
  if (visibleText) {
    return { source: "visible-text", title: visibleText };
  }
  const textContentFallback = normalizeConversationTitle(candidates.textContentFallback);
  if (textContentFallback) {
    return { source: "text-content-fallback", title: textContentFallback };
  }
  const ariaLabel = normalizeConversationTitle(candidates.ariaLabel);
  if (ariaLabel) {
    return { source: "aria-label", title: ariaLabel };
  }
  const titleAttribute = normalizeConversationTitle(candidates.titleAttribute);
  if (titleAttribute) {
    return { source: "title-attribute", title: titleAttribute };
  }
  return { source: "none", title: "" };
}

export function collectDetectedConversationMetadata(
  conversations: readonly DetectedConversationIdentityInput[],
): Map<string, DetectedConversationMetadata> {
  const detected = new Map<string, DetectedConversationMetadata>();
  const ambiguousConversationIds = new Set<string>();

  for (const conversation of conversations) {
    if (!conversation.titleResolved) {
      continue;
    }
    const normalized = normalizeConversationIdentity(conversation);
    if (!normalized.ok || !normalized.titleResolved) {
      continue;
    }
    const { conversationId, title, url } = normalized.conversation;
    if (ambiguousConversationIds.has(conversationId)) {
      continue;
    }
    const existing = detected.get(conversationId);
    if (existing && (existing.title !== title || existing.url !== url)) {
      detected.delete(conversationId);
      ambiguousConversationIds.add(conversationId);
      continue;
    }
    detected.set(conversationId, { title, url });
  }

  return detected;
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

  const resolvedTitle = normalizeConversationTitle(input.title);
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
