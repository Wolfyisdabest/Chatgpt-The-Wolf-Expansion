import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getStableProfileImageIdentity,
  resolveChatGPTAccountEvidence,
} from "../src/accounts/accountIdentity";

const fixture = (name: string): string => readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "chatgpt-dom", name),
  "utf8",
);

const baseSignals = {
  accountEmailText: "",
  accountUsernameText: "",
  baseUrl: "https://chatgpt.com/",
  loggedOutControlVisible: false,
  profileImageSource: "",
  profileLabel: "Open profile menu",
  profilePresent: true,
};

test("logged-out fixture exposes the semantic login control used for fail-closed gating", () => {
  const html = fixture("chatgpt-logged-out-auth-controls.sanitized.html");
  assert.match(html, /data-mobile-auth-entry-action="login"/u);
  assert.deepEqual(resolveChatGPTAccountEvidence({
    ...baseSignals,
    loggedOutControlVisible: true,
    profilePresent: false,
  }), { state: "logged-out" });
});

test("missing or weak signed-in identity remains unresolved", () => {
  assert.deepEqual(resolveChatGPTAccountEvidence({
    ...baseSignals,
    profilePresent: false,
  }), { state: "unresolved", reason: "missing-profile", profileFingerprint: null });
  const weak = resolveChatGPTAccountEvidence({
    ...baseSignals,
    profileImageSource: "https://cdn.auth0.com/avatars/wo.png",
  });
  assert.equal(weak.state, "unresolved");
});

test("visible account settings evidence resolves identity without persisting auth material", () => {
  const html = fixture("chatgpt-settings-account-panel.sanitized.html");
  assert.match(html, /data-testid="account-info-email"/u);
  assert.match(html, /data-testid="account-info-username"/u);
  const evidence = resolveChatGPTAccountEvidence({
    ...baseSignals,
    accountEmailText: "fixture.user@example.invalid",
  });
  assert.equal(evidence.state, "identified");
  if (evidence.state === "identified") {
    assert.equal(evidence.source, "account-email");
    assert.equal(evidence.identity, "email:fixture.user@example.invalid");
  }
});

test("stable profile image identity excludes volatile query and fragment data", () => {
  const first = getStableProfileImageIdentity(
    "https://images.example.test/profile/users/1234567890/avatar.png?signature=one#x",
    "https://chatgpt.com/",
  );
  const second = getStableProfileImageIdentity(
    "https://images.example.test/profile/users/1234567890/avatar.png?signature=two#y",
    "https://chatgpt.com/",
  );
  assert.equal(first, second);
  assert.equal(first, "https://images.example.test/profile/users/1234567890/avatar.png");
});
