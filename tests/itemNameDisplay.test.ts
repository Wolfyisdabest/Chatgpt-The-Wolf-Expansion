import assert from "node:assert/strict";
import test from "node:test";
import {
  getItemNamePresentation,
  getItemNameOverflowState,
  getItemNameSemantics,
  getOverflowRevealMetrics,
} from "../src/features/quickAccess/itemNameDisplay";

test("Compact presentation is single-line and permits overflow reveal", () => {
  assert.deepEqual(getItemNamePresentation("compact"), {
    autoRevealOverflow: true,
    maxVisibleLines: 1,
    overflowStyle: "fade",
    singleLine: true,
  });
});

test("Full presentation is bounded to two lines and never starts automated reveal", () => {
  assert.deepEqual(getItemNamePresentation("full"), {
    autoRevealOverflow: false,
    maxVisibleLines: 2,
    overflowStyle: "fade",
    singleLine: false,
  });
});

test("short names have no overflow state or hover reveal", () => {
  assert.deepEqual(getItemNameOverflowState(80, 100, false), {
    fadeVisible: false,
    overflowing: false,
    revealMetrics: null,
  });
});

test("long names use fade state and receive bounded hover reveal metrics", () => {
  assert.deepEqual(getItemNameOverflowState(180, 100, false), {
    fadeVisible: true,
    overflowing: true,
    revealMetrics: {
      distancePixels: 80,
      durationSeconds: 2.5,
    },
  });
});

test("reduced motion preserves overflow fade but disables automatic reveal", () => {
  assert.deepEqual(getItemNameOverflowState(400, 100, true), {
    fadeVisible: true,
    overflowing: true,
    revealMetrics: null,
  });
});

test("visual clipping never changes visible, tooltip, or accessible title text", () => {
  const title = "A very long uninterrupted conversation title without injected dots";
  assert.deepEqual(getItemNameSemantics(title), {
    accessibleName: title,
    tooltip: title,
    visibleText: title,
  });
  assert.equal(getItemNameSemantics(title).visibleText.includes("…"), false);
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
