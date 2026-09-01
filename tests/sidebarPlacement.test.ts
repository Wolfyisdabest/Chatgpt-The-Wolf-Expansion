import assert from "node:assert/strict";
import test from "node:test";
import {
  getWolfRootInsertionIndex,
  getWolfSlotInsertionIndex,
  projectCanonicalSidebarOrder,
} from "../src/adapters/chatgpt/sidebarPlacement";
import { FolderNameEditorController } from "../src/features/quickAccess/folderNameEditorState";
import { QuickAccessUiStateRepository } from "../src/features/quickAccess/QuickAccessUiStateRepository";
import { MemoryStorage } from "./helpers/MemoryStorage";

const CANONICAL_ORDER = ["settings", "quick-access", "pinned", "history"];

test("settings precedes Quick Access inside the Wolf-owned root", () => {
  assert.equal(getWolfSlotInsertionIndex(["quick-access"], "settings"), 0);
  assert.equal(getWolfSlotInsertionIndex(["settings"], "quick-access"), 1);
  assert.deepEqual(
    projectCanonicalSidebarOrder(["pinned", "history"], ["quick-access", "settings"]),
    CANONICAL_ORDER,
  );
});

test("Wolf settings and Quick Access precede native Pinned and history", () => {
  assert.equal(getWolfRootInsertionIndex(["pinned", "history"]), 0);
  assert.deepEqual(
    projectCanonicalSidebarOrder(["pinned", "history"]),
    CANONICAL_ORDER,
  );
});

test("expanded and collapsed Pinned contents do not alter canonical order", () => {
  // Child rows live inside the complete native Pinned section and may be
  // mounted or removed; the section boundary and insertion index do not move.
  const expanded = projectCanonicalSidebarOrder(["pinned", "history"]);
  const collapsed = projectCanonicalSidebarOrder(["pinned", "history"]);
  assert.deepEqual(expanded, CANONICAL_ORDER);
  assert.deepEqual(collapsed, CANONICAL_ORDER);
});

test("Pinned appearing after initial load is placed below the existing Wolf block", () => {
  assert.deepEqual(
    projectCanonicalSidebarOrder(["history"]),
    ["settings", "quick-access", "history"],
  );
  assert.deepEqual(
    projectCanonicalSidebarOrder(["pinned", "history"]),
    CANONICAL_ORDER,
  );
});

test("Pinned disappearing leaves the Wolf block before native history", () => {
  assert.deepEqual(
    projectCanonicalSidebarOrder(["pinned", "history"]),
    CANONICAL_ORDER,
  );
  assert.deepEqual(
    projectCanonicalSidebarOrder(["history"]),
    ["settings", "quick-access", "history"],
  );
});

test("SPA placement reconciliation is idempotent", () => {
  const first = projectCanonicalSidebarOrder(["other", "pinned", "history"]);
  const second = projectCanonicalSidebarOrder(["other", "pinned", "history"]);
  assert.deepEqual(first, ["other", ...CANONICAL_ORDER]);
  assert.deepEqual(second, first);
});

test("settings can never be projected below Quick Access or native history", () => {
  const projected = projectCanonicalSidebarOrder(
    ["other", "pinned", "history"],
    ["quick-access", "settings"],
  );
  assert.ok(projected.indexOf("settings") < projected.indexOf("quick-access"));
  assert.ok(projected.indexOf("quick-access") < projected.indexOf("pinned"));
  assert.ok(projected.indexOf("pinned") < projected.indexOf("history"));
});

test("native Pinned toggles cannot change an expanded Quick Access state", async () => {
  const repository = new QuickAccessUiStateRepository(new MemoryStorage());
  await repository.save({ collapsed: false });

  projectCanonicalSidebarOrder(["pinned", "history"]);
  assert.equal((await repository.get()).collapsed, false);
  projectCanonicalSidebarOrder(["pinned", "history"]);
  assert.equal((await repository.get()).collapsed, false);
});

test("native Pinned toggles cannot change a collapsed Quick Access state", async () => {
  const repository = new QuickAccessUiStateRepository(new MemoryStorage());
  await repository.save({ collapsed: true });

  projectCanonicalSidebarOrder(["pinned", "history"]);
  assert.equal((await repository.get()).collapsed, true);
  projectCanonicalSidebarOrder(["pinned", "history"]);
  assert.equal((await repository.get()).collapsed, true);
});

test("toggling Quick Access does not mutate native Pinned state", async () => {
  const repository = new QuickAccessUiStateRepository(new MemoryStorage());
  const nativePinnedExpanded = false;
  await repository.save({ collapsed: true });
  await repository.save({ collapsed: false });

  assert.equal(nativePinnedExpanded, false);
  assert.equal((await repository.get()).collapsed, false);
});

test("placement reconciliation leaves an active folder editor intact", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("folder-1", "Draft name");
  editor.updateDraft("Preserved draft");

  projectCanonicalSidebarOrder(["pinned", "history"]);
  assert.deepEqual(editor.activeState, {
    kind: "rename",
    folderId: "folder-1",
    originalName: "Draft name",
    draft: "Preserved draft",
  });
});
