import assert from "node:assert/strict";
import test from "node:test";
import { parseConversationId } from "../src/adapters/chatgpt/conversationUrl";

const conversationId = "12345678-1234-1234-1234-123456789abc";

test("extracts an ID from absolute and relative ChatGPT conversation URLs", () => {
  assert.equal(parseConversationId(`https://chatgpt.com/c/${conversationId}`), conversationId);
  assert.equal(parseConversationId(`/c/${conversationId}`), conversationId);
});

test("accepts safe future non-UUID conversation IDs", () => {
  assert.equal(parseConversationId("/c/future-id_abc.123"), "future-id_abc.123");
});

test("rejects unrelated origins, paths, and encoded separators", () => {
  assert.equal(parseConversationId(`https://example.com/c/${conversationId}`), null);
  assert.equal(parseConversationId(`/g/${conversationId}`), null);
  assert.equal(parseConversationId(`/c/${conversationId}/messages`), null);
  assert.equal(parseConversationId("/c/not%2Fa-row"), null);
});
