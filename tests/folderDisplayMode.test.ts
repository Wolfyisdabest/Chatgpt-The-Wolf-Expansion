import assert from "node:assert/strict";
import test from "node:test";
import {
  getFolderChatNameDisplayChoice,
  pruneFolderChatNameDisplayOverrides,
  resolveChatNameDisplayMode,
} from "../src/settings/folderDisplayMode";
import type { FolderRecord } from "../src/storage/schemas";

function folder(
  id: string,
  parentId: string | null,
  name = id,
): FolderRecord {
  return { id, name, parentId, sortIndex: 0, createdAt: 1, collapsed: false };
}

test("global Compact and Full apply when no folder override exists", () => {
  const folders = [folder("root", null), folder("child", "root")];
  assert.equal(resolveChatNameDisplayMode("child", folders, {}, "compact"), "compact");
  assert.equal(resolveChatNameDisplayMode("child", folders, {}, "full"), "full");
});

test("root folder overrides beat the global default", () => {
  const folders = [folder("root", null)];
  assert.equal(resolveChatNameDisplayMode("root", folders, { root: "full" }, "compact"), "full");
  assert.equal(resolveChatNameDisplayMode("root", folders, { root: "compact" }, "full"), "compact");
});

test("nested folders inherit the nearest ancestor and explicit child wins", () => {
  const folders = [
    folder("development", null),
    folder("testing", "development"),
    folder("logs", "testing"),
  ];
  assert.equal(resolveChatNameDisplayMode(
    "testing",
    folders,
    { development: "full" },
    "compact",
  ), "full");
  assert.equal(resolveChatNameDisplayMode(
    "logs",
    folders,
    { development: "full", logs: "compact" },
    "compact",
  ), "compact");
});

test("moving an inheriting folder recalculates its effective mode", () => {
  const moved = folder("moving", null);
  const folders = [folder("full-parent", null), moved];
  assert.equal(resolveChatNameDisplayMode(moved.id, folders, { "full-parent": "full" }, "compact"), "compact");
  moved.parentId = "full-parent";
  assert.equal(resolveChatNameDisplayMode(moved.id, folders, { "full-parent": "full" }, "compact"), "full");
});

test("overrides use folder IDs so rename and duplicate names remain independent", () => {
  const first = folder("first", null, "Duplicate");
  const second = folder("second", null, "Duplicate");
  first.name = "Renamed";
  assert.equal(getFolderChatNameDisplayChoice(first.id, { first: "full" }), "full");
  assert.equal(getFolderChatNameDisplayChoice(second.id, { first: "full" }), "inherit");
});

test("root chats always use the global default", () => {
  assert.equal(resolveChatNameDisplayMode(null, [], { unrelated: "full" }, "compact"), "compact");
  assert.equal(resolveChatNameDisplayMode(null, [], { unrelated: "compact" }, "full"), "full");
});

test("malformed cycles fail safely at the global default", () => {
  const folders = [folder("a", "b"), folder("b", "a")];
  assert.equal(resolveChatNameDisplayMode("a", folders, {}, "compact"), "compact");
});

test("orphan overrides are pruned without changing valid overrides", () => {
  assert.deepEqual(
    pruneFolderChatNameDisplayOverrides(
      { valid: "full", orphan: "compact" },
      new Set(["valid"]),
    ),
    { valid: "full" },
  );
});
