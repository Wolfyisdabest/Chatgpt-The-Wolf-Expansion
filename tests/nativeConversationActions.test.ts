import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveExactNativeConversationAction } from "../src/adapters/chatgpt/nativeConversationActions";

test("exact conversation ID resolves its single native action trigger", () => {
  const trigger = { id: "native-menu" };
  assert.deepEqual(resolveExactNativeConversationAction("chat-a", 1, [{
    conversationIds: ["chat-a"],
    triggers: [trigger],
    wolfOwned: false,
  }]), { status: "available", trigger });
});

test("titles and row position are not inputs to native action targeting", () => {
  const wrong = { id: "wrong" };
  const correct = { id: "correct" };
  assert.deepEqual(resolveExactNativeConversationAction("chat-b", 1, [
    { conversationIds: ["chat-a"], triggers: [wrong], wolfOwned: false },
    { conversationIds: ["chat-b"], triggers: [correct], wolfOwned: false },
  ]), { status: "available", trigger: correct });
});

test("unmounted native row reports unavailable", () => {
  assert.deepEqual(resolveExactNativeConversationAction("chat-a", 0, []), {
    status: "unavailable",
    reason: "row-not-mounted",
  });
});

test("missing native action trigger fails closed", () => {
  assert.deepEqual(resolveExactNativeConversationAction("chat-a", 1, []), {
    status: "unavailable",
    reason: "action-not-found",
  });
});

test("ambiguous row identities and duplicate native rows refuse delegation", () => {
  assert.deepEqual(resolveExactNativeConversationAction("chat-a", 1, [{
    conversationIds: ["chat-a", "chat-b"],
    triggers: [{ id: "uncertain" }],
    wolfOwned: false,
  }]), { status: "unavailable", reason: "ambiguous" });
  assert.deepEqual(resolveExactNativeConversationAction("chat-a", 2, [
    { conversationIds: ["chat-a"], triggers: [{ id: "first" }], wolfOwned: false },
    { conversationIds: ["chat-a"], triggers: [{ id: "second" }], wolfOwned: false },
  ]), { status: "unavailable", reason: "ambiguous" });
});

test("Wolf-owned rows are excluded from native action resolution", () => {
  assert.deepEqual(resolveExactNativeConversationAction("chat-a", 1, [{
    conversationIds: ["chat-a"],
    triggers: [{ id: "wolf-menu" }],
    wolfOwned: true,
  }]), { status: "unavailable", reason: "action-not-found" });
});

test("Quick Access actions delegate through the native trigger without navigation or destructive APIs", () => {
  const adapter = readFileSync(
    path.join(process.cwd(), "src/adapters/chatgpt/ChatGPTAdapter.ts"),
    "utf8",
  );
  const sidebar = readFileSync(
    path.join(process.cwd(), "src/features/quickAccess/QuickAccessSidebar.ts"),
    "utf8",
  );
  assert.match(sidebar, /openNativeConversationActions\(chat\.conversationId\)/);
  assert.match(adapter, /trigger\.click\(\)/);
  assert.doesNotMatch(adapter, /(?:fetch|XMLHttpRequest|document\.cookie)\s*\(/);
  assert.doesNotMatch(sidebar, /location\.(?:assign|replace)|history\.(?:pushState|replaceState)/);
});

test("native Rename remains menu-owned and no Wolf alias write is introduced", () => {
  const sidebar = readFileSync(
    path.join(process.cwd(), "src/features/quickAccess/QuickAccessSidebar.ts"),
    "utf8",
  );
  assert.doesNotMatch(sidebar, /renameConversation|conversationAlias|setConversationTitle/);
});

test("existing native portal integration owns Wolf action injection and deduplicates containers", () => {
  const integration = readFileSync(
    path.join(process.cwd(), "src/features/quickAccess/QuickAccessMenuIntegration.ts"),
    "utf8",
  );
  assert.match(integration, /watchConversationMenus/);
  assert.match(integration, /element !== matching/);
  assert.match(integration, /if \(!matching\) \{\s*context\.menu\.append\(container\);/s);
  assert.doesNotMatch(integration, /document\.body\.append\(context\.menu\)/);
});
