import assert from "node:assert/strict";
import test from "node:test";
import {
  getItemNamePresentation,
  getOverflowRevealMetrics,
} from "../src/features/quickAccess/itemNameDisplay";

test("Compact presentation is single-line and permits overflow reveal", () => {
  assert.deepEqual(getItemNamePresentation("compact"), {
    autoRevealOverflow: true,
    singleLine: true,
  });
});

test("Full presentation wraps and never starts automated reveal", () => {
  assert.deepEqual(getItemNamePresentation("full"), {
    autoRevealOverflow: false,
    singleLine: false,
  });
});

test("overflow reveal activates only when the rendered name overflows", () => {
  assert.equal(getOverflowRevealMetrics(100, 100, false), null);
  assert.equal(getOverflowRevealMetrics(80, 100, false), null);
  assert.deepEqual(getOverflowRevealMetrics(180, 100, false), {
    distancePixels: 80,
    durationSeconds: 2.5,
  });
});

test("reduced motion disables automatic overflow reveal", () => {
  assert.equal(getOverflowRevealMetrics(400, 100, true), null);
});

test("overflow reveal duration scales but remains bounded", () => {
  assert.equal(getOverflowRevealMetrics(500, 100, false)?.durationSeconds, 12);
  assert.equal(getOverflowRevealMetrics(120, 100, false)?.durationSeconds, 2.5);
});
