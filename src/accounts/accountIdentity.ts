export type ChatGPTAccountEvidence =
  | { state: "logged-out" }
  | {
      profileFingerprint: string | null;
      reason: "missing-profile" | "weak-profile";
      state: "unresolved";
    }
  | {
      identity: string;
      profileFingerprint: string | null;
      source: "account-email" | "account-username" | "profile-image";
      state: "identified";
    };

export interface ChatGPTAccountSignals {
  accountEmailText: string;
  accountUsernameText: string;
  baseUrl: string;
  loggedOutControlVisible: boolean;
  profileImageSource: string;
  profileLabel: string;
  profilePresent: boolean;
}

export async function createOpaqueAccountScopeId(identity: string): Promise<string> {
  const data = new TextEncoder().encode(`wolf-expansion-account-scope\0${identity}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `sha256-${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")).join("")}`;
}

export function isLikelyUniqueProfileImage(value: string, baseUrl: string): boolean {
  return getStableProfileImageIdentity(value, baseUrl) !== null;
}

export function getStableProfileImageIdentity(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (!/^https?:$/u.test(url.protocol) || url.hostname === "example.invalid") {
      return null;
    }
    if (
      url.hostname === "cdn.auth0.com" &&
      /^\/avatars\/[a-z0-9_-]{1,8}\.(?:png|jpe?g|webp)$/iu.test(url.pathname)
    ) {
      return null;
    }
    const identityMaterial = `${url.origin}${url.pathname}`;
    return identityMaterial.length >= 32 && /[a-z]/iu.test(identityMaterial) &&
      /[0-9]/u.test(identityMaterial)
      ? identityMaterial
      : null;
  } catch {
    return null;
  }
}

export function normalizeAccountIdentityValue(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

export function resolveChatGPTAccountEvidence(
  signals: ChatGPTAccountSignals,
): ChatGPTAccountEvidence {
  if (!signals.profilePresent) {
    return signals.loggedOutControlVisible
      ? { state: "logged-out" }
      : { state: "unresolved", reason: "missing-profile", profileFingerprint: null };
  }

  const stableImageIdentity = getStableProfileImageIdentity(
    signals.profileImageSource,
    signals.baseUrl,
  );
  const profileFingerprint = `${normalizeAccountIdentityValue(signals.profileLabel)}\0${
    stableImageIdentity ?? signals.profileImageSource.trim()
  }`;
  if (stableImageIdentity) {
    return {
      identity: `profile-image:${stableImageIdentity}`,
      profileFingerprint,
      source: "profile-image",
      state: "identified",
    };
  }

  const email = signals.accountEmailText.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
  )?.[0];
  if (email) {
    return {
      identity: `email:${normalizeAccountIdentityValue(email)}`,
      profileFingerprint,
      source: "account-email",
      state: "identified",
    };
  }
  const username = signals.accountUsernameText.match(/@[\p{L}\p{N}_.-]{2,}/u)?.[0];
  if (username) {
    return {
      identity: `username:${normalizeAccountIdentityValue(username)}`,
      profileFingerprint,
      source: "account-username",
      state: "identified",
    };
  }
  return { state: "unresolved", reason: "weak-profile", profileFingerprint };
}
