export type NativeConversationActionUnavailableReason =
  | "row-not-mounted"
  | "action-not-found"
  | "ambiguous"
  | "unsupported";

export type NativeConversationActionResult =
  | { status: "delegated" }
  | {
      status: "unavailable";
      reason: NativeConversationActionUnavailableReason;
    };

export interface NativeConversationActionCandidate<TTrigger> {
  conversationIds: readonly string[];
  triggers: readonly TTrigger[];
  wolfOwned: boolean;
}

export type NativeConversationActionResolution<TTrigger> =
  | { status: "available"; trigger: TTrigger }
  | {
      status: "unavailable";
      reason: Exclude<NativeConversationActionUnavailableReason, "unsupported">;
    };

export function resolveExactNativeConversationAction<TTrigger>(
  conversationId: string,
  matchingNativeLinkCount: number,
  candidates: readonly NativeConversationActionCandidate<TTrigger>[],
): NativeConversationActionResolution<TTrigger> {
  if (matchingNativeLinkCount === 0) {
    return { status: "unavailable", reason: "row-not-mounted" };
  }

  const relevantCandidates = candidates.filter((candidate) => {
    const identities = new Set(candidate.conversationIds);
    return !candidate.wolfOwned && identities.has(conversationId);
  });
  if (relevantCandidates.length === 0) {
    return { status: "unavailable", reason: "action-not-found" };
  }
  if (
    relevantCandidates.length !== 1 ||
    relevantCandidates.some((candidate) => new Set(candidate.conversationIds).size !== 1) ||
    relevantCandidates[0]!.triggers.length !== 1
  ) {
    return { status: "unavailable", reason: "ambiguous" };
  }
  return { status: "available", trigger: relevantCandidates[0]!.triggers[0]! };
}
