import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDetectedConversationMetadata,
  normalizeConversationIdentity,
  normalizeConversationTitle,
  selectConversationTitle,
  selectConversationTitleWithSource,
} from "../src/adapters/chatgpt/conversationIdentity";

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

test("preserves literal conversation titles that mention Pinned or OpenAI Pin", () => {
  const literalTitles = [
    "Pinned: Test Chat",
    "Test Chat (Pinned)",
    "Something — Pinned",
    "Test Chat [Pinned]",
    "OpenAI Pin",
    "Pinned",
    "My (Pinned) Notes",
    "Pinned:",
  ];

  for (const title of literalTitles) {
    assert.equal(normalizeConversationTitle(title), title);
  }
});

test("normalizes only extraction whitespace without interpreting title content", () => {
  assert.equal(
    normalizeConversationTitle("  Pinned:\n  Test\tChat  "),
    "Pinned: Test Chat",
  );
});

test("prefers current visible row text over stale title attributes", () => {
  assert.equal(selectConversationTitle({
    visibleText: "New live title",
    ariaLabel: "Old aria title",
    titleAttribute: "Old title attribute",
  }), "New live title");
  assert.equal(selectConversationTitle({
    visibleText: "   ",
    ariaLabel: "Accessible fallback",
    titleAttribute: "Tooltip fallback",
  }), "Accessible fallback");
  assert.deepEqual(selectConversationTitleWithSource({
    visibleText: "",
    textContentFallback: "Hidden or detached fallback",
    ariaLabel: "Stale accessible title",
  }), {
    source: "text-content-fallback",
    title: "Hidden or detached fallback",
  });
});

test("detected metadata rejects unresolved and conflicting transitional titles", () => {
  const detected = collectDetectedConversationMetadata([
    {
      conversationId: "stable",
      title: "Stable title",
      url: "/c/stable",
      titleResolved: true,
    },
    {
      conversationId: "blank",
      title: "Untitled conversation",
      url: "/c/blank",
      titleResolved: false,
    },
    {
      conversationId: "renaming",
      title: "Old title",
      url: "/c/renaming",
      titleResolved: true,
    },
    {
      conversationId: "renaming",
      title: "New title",
      url: "/c/renaming",
      titleResolved: true,
    },
  ]);

  assert.deepEqual([...detected.entries()], [[
    "stable",
    { title: "Stable title", url: "https://chatgpt.com/c/stable" },
  ]]);
});
