import assert from "node:assert/strict";
import test from "node:test";
import {
  getItemNameRevealPresentation,
  getItemNamePresentation,
  getItemNameOverflowState,
  getItemNameReadableViewport,
  getItemNameRevealWidth,
  getItemNameSemantics,
  getOverflowRevealMetrics,
  getUnobscuredItemNameWidth,
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

test("live title change from long to short clears overflow and reveal state", () => {
  const beforeRename = getItemNameOverflowState(260, 100, false);
  const afterRename = getItemNameOverflowState(70, 100, false);
  assert.equal(beforeRename.overflowing, true);
  assert.notEqual(beforeRename.revealMetrics, null);
  assert.deepEqual(afterRename, {
    fadeVisible: false,
    overflowing: false,
    revealMetrics: null,
  });
});

test("live title change from short to long becomes eligible for overflow reveal", () => {
  const beforeRename = getItemNameOverflowState(70, 100, false);
  const afterRename = getItemNameOverflowState(260, 100, false);
  assert.equal(beforeRename.overflowing, false);
  assert.equal(afterRename.fadeVisible, true);
  assert.notEqual(afterRename.revealMetrics, null);
});

test("overflow reveal duration scales but remains bounded", () => {
  assert.equal(getOverflowRevealMetrics(500, 100, false)?.durationSeconds, 12);
  assert.equal(getOverflowRevealMetrics(120, 100, false)?.durationSeconds, 2.5);
});

test("hover reveal uses the exact overflow geometry and disables its fade", () => {
  assert.deepEqual(getItemNameRevealPresentation(237, 101, false, "revealing"), {
    controlsSuppressed: true,
    fadeVisible: false,
    usesFullWidth: true,
    translatePixels: 136,
  });
});

test("hover reveal geometry excludes the measured action-control overlap", () => {
  const readableWidth = getUnobscuredItemNameWidth(140, 36);
  assert.equal(readableWidth, 104);
  assert.deepEqual(getItemNameRevealPresentation(237, readableWidth, false, "revealing"), {
    controlsSuppressed: true,
    fadeVisible: false,
    usesFullWidth: true,
    translatePixels: 133,
  });
});

test("readable viewport clips only the physical action overlap", () => {
  assert.deepEqual(
    getItemNameReadableViewport(180, 20, 200, 152, 198, "ltr"),
    {
      clientWidth: 132,
      clipLeftPixels: 0,
      clipRightPixels: 48,
      inlineEndOcclusion: 48,
    },
  );
  assert.deepEqual(
    getItemNameReadableViewport(180, 20, 200, 22, 68, "rtl"),
    {
      clientWidth: 132,
      clipLeftPixels: 48,
      clipRightPixels: 0,
      inlineEndOcclusion: 48,
    },
  );
});

test("pointer-leave return keeps the fade disabled until transform reset", () => {
  assert.deepEqual(getItemNameRevealPresentation(237, 101, false, "returning"), {
    controlsSuppressed: true,
    fadeVisible: false,
    usesFullWidth: true,
    translatePixels: 0,
  });
  assert.deepEqual(getItemNameRevealPresentation(237, 101, false, "idle"), {
    controlsSuppressed: false,
    fadeVisible: true,
    usesFullWidth: false,
    translatePixels: 0,
  });
});

test("active Compact reveal suppresses controls and uses full-width geometry", () => {
  assert.equal(getItemNameRevealWidth(180, 48, false), 132);
  assert.equal(getItemNameRevealWidth(180, 48, true), 180);
});

test("no overflow and reduced motion never enter an automated reveal state", () => {
  assert.deepEqual(getItemNameRevealPresentation(80, 100, false, "revealing"), {
    controlsSuppressed: false,
    fadeVisible: false,
    usesFullWidth: false,
    translatePixels: 0,
  });
  assert.deepEqual(getItemNameRevealPresentation(237, 101, true, "revealing"), {
    controlsSuppressed: false,
    fadeVisible: true,
    usesFullWidth: false,
    translatePixels: 0,
  });
});
