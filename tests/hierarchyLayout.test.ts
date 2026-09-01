import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getChevronPresentation,
  getQuickAccessHierarchyLayout,
} from "../src/features/quickAccess/hierarchyLayout";
import { getOverflowRevealMetrics } from "../src/features/quickAccess/itemNameDisplay";

test("root folders and root chats share visual depth one below Quick Access", () => {
  const folder = getQuickAccessHierarchyLayout(0, "folder");
  const chat = getQuickAccessHierarchyLayout(0, "chat");
  assert.equal(folder.visualDepth, 1);
  assert.equal(chat.visualDepth, 1);
  assert.deepEqual(folder, chat);
});

test("nested folders and chats advance exactly one visual depth per level", () => {
  const root = getQuickAccessHierarchyLayout(0, "folder");
  const nestedFolder = getQuickAccessHierarchyLayout(1, "folder");
  const nestedChat = getQuickAccessHierarchyLayout(1, "chat");
  const deepChat = getQuickAccessHierarchyLayout(2, "chat");
  assert.equal(nestedFolder.visualDepth, root.visualDepth + 1);
  assert.equal(nestedChat.visualDepth, root.visualDepth + 1);
  assert.equal(deepChat.visualDepth, nestedFolder.visualDepth + 1);
});

test("hierarchy layout is stable across reconciliation", () => {
  const before = getQuickAccessHierarchyLayout(4, "folder");
  const after = getQuickAccessHierarchyLayout(4, "folder");
  assert.deepEqual(after, before);
});

test("nested depth never introduces depth-dependent font sizing", () => {
  const css = readFileSync(
    path.join(process.cwd(), "src/features/quickAccess/quick-access.css"),
    "utf8",
  );
  assert.doesNotMatch(css, /data-(?:logical|visual)-depth[^}]*font-size/s);
  assert.match(css, /\.wolf-folder-name\s*\{[^}]*font:\s*inherit;/s);
  assert.match(css, /\.wolf-quick-access-chat-link\s*\{[^}]*font:\s*inherit;/s);
});

test("compact overflow calculations remain scoped to the indented text viewport", () => {
  assert.deepEqual(getOverflowRevealMetrics(220, 84, false), {
    distancePixels: 136,
    durationSeconds: 4.25,
  });
});

test("invalid logical depths fail safely at the root visual level", () => {
  assert.equal(getQuickAccessHierarchyLayout(-1, "folder").visualDepth, 1);
  assert.equal(getQuickAccessHierarchyLayout(1.5, "chat").visualDepth, 1);
});

test("collapsed Quick Access and folders use a right-facing chevron", () => {
  assert.deepEqual(getChevronPresentation(false), {
    direction: "right",
    icon: "chevron-right",
  });
});

test("expanded Quick Access and folders rotate the right chevron downward", () => {
  assert.deepEqual(getChevronPresentation(true), {
    direction: "down",
    icon: "chevron-right",
  });
});
