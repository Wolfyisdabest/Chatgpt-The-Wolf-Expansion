import assert from "node:assert/strict";
import test from "node:test";
import { parseConversationId } from "../src/adapters/chatgpt/conversationUrl";
import { TransientMenuTargetStore } from "../src/adapters/chatgpt/menuContext";
import { getFavoriteActionLabel } from "../src/features/favorites/favoriteActionState";

test("keeps a sidebar menu target transient and expires it", () => {
  const store = new TransientMenuTargetStore<{ conversationId: string }>(3_000);
  store.remember({
    kind: "sidebar-conversation",
    conversation: { conversationId: "chat-a" },
    controlledElementId: "menu-a",
    openedAt: 1_000,
  });

  assert.equal(store.current(3_999)?.conversation.conversationId, "chat-a");
  assert.equal(store.current(4_001), null);
});

test("clears a transient menu target when its menu closes", () => {
  const store = new TransientMenuTargetStore<{ conversationId: string }>(3_000);
  store.remember({
    kind: "current-conversation",
    conversation: { conversationId: "chat-current" },
    controlledElementId: null,
    openedAt: 1_000,
  });

  store.clear();
  assert.equal(store.current(1_001), null);
});

test("resolves a current conversation menu only from a conversation URL", () => {
  assert.equal(parseConversationId("https://chatgpt.com/c/current-chat"), "current-chat");
  assert.equal(parseConversationId("https://chatgpt.com/"), null);
  assert.equal(parseConversationId("https://chatgpt.com/library"), null);
  assert.equal(parseConversationId("https://chatgpt.com/search"), null);
});

test("projects Quick Access state into menu and debug action labels", () => {
  assert.equal(getFavoriteActionLabel(false, "menu"), "Add to Quick Access");
  assert.equal(getFavoriteActionLabel(true, "menu"), "Remove from Quick Access");
  assert.equal(
    getFavoriteActionLabel(false, "debug-current"),
    "Debug: Add current chat to Quick Access",
  );
  assert.equal(
    getFavoriteActionLabel(true, "debug-current"),
    "Debug: Remove current chat from Quick Access",
  );
});
