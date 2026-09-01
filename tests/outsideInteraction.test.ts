import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldCancelFolderNameEditor,
  shouldCloseFolderMenu,
} from "../src/features/quickAccess/outsideInteraction";

test("folder menu remains open for its menu and own trigger", () => {
  assert.equal(shouldCloseFolderMenu(true, false), false);
  assert.equal(shouldCloseFolderMenu(false, true), false);
});

test("folder menu closes for a clear outside pointer target", () => {
  assert.equal(shouldCloseFolderMenu(false, false), true);
});

test("folder editor cancels only for explicit outside pointer origin", () => {
  assert.equal(shouldCancelFolderNameEditor(true), false);
  assert.equal(shouldCancelFolderNameEditor(false), true);
});
