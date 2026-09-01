import assert from "node:assert/strict";
import test from "node:test";
import { ExclusiveDragIndicator } from "../src/features/quickAccess/dragIndicatorState";

test("activating a new drag target returns and replaces the previous target", () => {
  const state = new ExclusiveDragIndicator<string>();
  assert.equal(state.activate("first"), null);
  assert.equal(state.current, "first");
  assert.equal(state.activate("second"), "first");
  assert.equal(state.current, "second");
});

test("leaving an inactive target does not clear the active indicator", () => {
  const state = new ExclusiveDragIndicator<string>();
  state.activate("active");
  assert.equal(state.clear("old"), null);
  assert.equal(state.current, "active");
});

test("drag cancel and successful drop clear all indicator state", () => {
  const state = new ExclusiveDragIndicator<string>();
  state.activate("active");
  assert.equal(state.clear(), "active");
  assert.equal(state.current, null);
  state.activate("next");
  assert.equal(state.clear("next"), "next");
  assert.equal(state.current, null);
});
