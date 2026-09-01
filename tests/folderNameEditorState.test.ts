import assert from "node:assert/strict";
import test from "node:test";
import {
  FolderNameEditorController,
  isFolderDraggable,
} from "../src/features/quickAccess/folderNameEditorState";
import { FoldersRepository } from "../src/features/folders/FoldersRepository";
import { buildQuickAccessProjection } from "../src/features/quickAccess/quickAccessProjection";
import { MemoryStorage } from "./helpers/MemoryStorage";

test("root and subfolder creation drafts retain their parent identity", () => {
  const editor = new FolderNameEditorController();
  assert.deepEqual(editor.startCreate(null), { kind: "create", parentId: null, draft: "" });
  editor.updateDraft("Root folder");
  assert.equal(editor.activeState?.draft, "Root folder");
  editor.cancel();
  assert.deepEqual(editor.startCreate("parent-id"), {
    kind: "create",
    parentId: "parent-id",
    draft: "",
  });
});

test("root and subfolder rename state keeps folder identity and draft", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("root-id", "Root");
  editor.updateDraft("Renamed root");
  assert.deepEqual(editor.activeState, {
    kind: "rename",
    folderId: "root-id",
    originalName: "Root",
    draft: "Renamed root",
  });
  editor.cancel();
  editor.startRename("child-id", "Child");
  assert.equal(editor.activeState?.kind, "rename");
  assert.equal(editor.activeState && "folderId" in editor.activeState
    ? editor.activeState.folderId
    : null, "child-id");
});

test("Enter commits a trimmed rename without changing folder ID and clears state", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("stable-id", "Before");
  editor.updateDraft("  After  ");
  assert.deepEqual(editor.resolveEnter(), {
    status: "commit",
    state: {
      kind: "rename",
      folderId: "stable-id",
      originalName: "Before",
      draft: "  After  ",
    },
    name: "After",
  });
  assert.equal(editor.activeState, null);
});

test("Escape-style cancellation clears state and preserves the original rename value", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("folder-id", "Original");
  editor.updateDraft("Discard me");
  const result = editor.cancel();
  assert.equal(result?.status, "cancel");
  assert.equal(result?.state.kind, "rename");
  assert.equal(result?.state.kind === "rename" ? result.state.originalName : null, "Original");
  assert.equal(editor.activeState, null);
});

test("empty and whitespace-only Enter remain invalid and keep the editor active", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("folder-id", "Original");
  editor.updateDraft("");
  assert.equal(editor.resolveEnter()?.status, "invalid");
  assert.notEqual(editor.activeState, null);
  editor.updateDraft("   ");
  assert.equal(editor.resolveEnter()?.status, "invalid");
  assert.notEqual(editor.activeState, null);
});

test("blur commits a valid changed name, exits unchanged, and cancels invalid input", () => {
  const changed = new FolderNameEditorController();
  changed.startRename("folder-id", "Before");
  changed.updateDraft("After");
  assert.equal(changed.resolveBlur()?.status, "commit");
  assert.equal(changed.activeState, null);

  const unchanged = new FolderNameEditorController();
  unchanged.startRename("folder-id", "Same");
  assert.equal(unchanged.resolveBlur()?.status, "unchanged");
  assert.equal(unchanged.activeState, null);

  const invalid = new FolderNameEditorController();
  invalid.startRename("folder-id", "Before");
  invalid.updateDraft("  ");
  assert.equal(invalid.resolveBlur()?.status, "cancel");
  assert.equal(invalid.activeState, null);
});

test("creation rejects empty input, accepts duplicate names, and clears after commit", async () => {
  const storage = new MemoryStorage();
  let nextId = 1;
  const folders = new FoldersRepository(storage, undefined, () => `generated-${nextId++}`);
  await folders.createFolder("Duplicate");

  const invalid = new FolderNameEditorController();
  invalid.startCreate(null);
  assert.equal(invalid.resolveEnter()?.status, "invalid");
  assert.notEqual(invalid.activeState, null);

  const editor = new FolderNameEditorController();
  editor.startCreate(null);
  editor.updateDraft("Duplicate");
  const resolution = editor.resolveEnter();
  assert.equal(resolution?.status, "commit");
  if (resolution?.status !== "commit") {
    return;
  }
  const created = await folders.createFolder(resolution.name, null);
  assert.equal(created.name, "Duplicate");
  assert.equal(created.id, "generated-2");
  assert.equal(editor.activeState, null);
});

test("active rename draft survives unrelated projection work", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("folder-id", "Before");
  editor.updateDraft("Work in progress");
  buildQuickAccessProjection([], [], [], {
    quickAccessEnabled: true,
    foldersEnabled: true,
  });
  assert.equal(editor.activeState?.draft, "Work in progress");
});

test("the edited folder is not draggable and drag capability returns after editing", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("folder-a", "Folder A");
  assert.equal(isFolderDraggable(editor.activeState, "folder-a"), false);
  assert.equal(isFolderDraggable(editor.activeState, "folder-b"), true);
  editor.cancel();
  assert.equal(isFolderDraggable(editor.activeState, "folder-a"), true);
  editor.startCreate("folder-a");
  assert.equal(isFolderDraggable(editor.activeState, "folder-a"), false);
  assert.equal(isFolderDraggable(editor.activeState, "folder-b"), true);
});

test("duplicate rename values are accepted because names are not identity", () => {
  const editor = new FolderNameEditorController();
  editor.startRename("folder-b", "Old name");
  editor.updateDraft("Duplicate");
  const resolution = editor.resolveEnter();
  assert.equal(resolution?.status, "commit");
  assert.equal(resolution?.status === "commit" ? resolution.name : null, "Duplicate");
});
