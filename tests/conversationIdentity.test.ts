import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConversationIdentity } from "../src/adapters/chatgpt/conversationIdentity";

test("normalizes sidebar and top-right inputs to the same plain identity shape", () => {
  const sidebarInput = {
    conversationId: "chat-a",
    title: "Sidebar title",
    url: "https://chatgpt.com/c/chat-a",
    link: { nonCloneableDomPlaceholder: true },
  };
  const topRightInput = {
    conversationId: "chat-b",
    title: "Top-right title",
    url: "https://chatgpt.com/c/chat-b",
  };

  assert.deepEqual(normalizeConversationIdentity(sidebarInput), {
    ok: true,
    conversation: {
      conversationId: "chat-a",
      title: "Sidebar title",
      url: "https://chatgpt.com/c/chat-a",
    },
    titleResolved: true,
  });
  assert.deepEqual(normalizeConversationIdentity(topRightInput), {
    ok: true,
    conversation: {
      conversationId: "chat-b",
      title: "Top-right title",
      url: "https://chatgpt.com/c/chat-b",
    },
    titleResolved: true,
  });
});

test("rejects malformed or mismatched conversation identity", () => {
  assert.equal(
    normalizeConversationIdentity({ title: "Missing ID", url: "/c/chat-a" }).ok,
    false,
  );
  assert.equal(
    normalizeConversationIdentity({
      conversationId: "chat-a",
      title: "Wrong URL",
      url: "https://chatgpt.com/c/chat-b",
    }).ok,
    false,
  );
  assert.equal(
    normalizeConversationIdentity({
      conversationId: "chat-a",
      title: "Wrong origin",
      url: "https://example.com/c/chat-a",
    }).ok,
    false,
  );
});

test("uses a safe title fallback without changing conversation identity", () => {
  assert.deepEqual(
    normalizeConversationIdentity({
      conversationId: "chat-untitled",
      title: "   ",
      url: "/c/chat-untitled",
    }),
    {
      ok: true,
      conversation: {
        conversationId: "chat-untitled",
        title: "Untitled conversation",
        url: "https://chatgpt.com/c/chat-untitled",
      },
      titleResolved: false,
    },
  );
});
