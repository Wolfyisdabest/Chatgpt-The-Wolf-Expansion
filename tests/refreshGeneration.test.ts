import assert from "node:assert/strict";
import test from "node:test";
import { QuickAccessRefreshCoordinator } from "../src/features/quickAccess/refreshGeneration";

test("newer refresh generation prevents an older title snapshot from rendering", () => {
  const coordinator = new QuickAccessRefreshCoordinator();
  const oldGeneration = coordinator.request("sidebar");
  assert.deepEqual(coordinator.takeNext(), {
    generation: oldGeneration,
    ingestDetectedTitles: true,
  });
  const newGeneration = coordinator.request("sidebar");
  assert.equal(coordinator.isLatest(oldGeneration), false);
  assert.equal(coordinator.isLatest(newGeneration), true);
  assert.deepEqual(coordinator.takeNext(), {
    generation: newGeneration,
    ingestDetectedTitles: true,
  });
});

test("rapid One to Two to Three requests leave only Three render-authoritative", () => {
  const coordinator = new QuickAccessRefreshCoordinator();
  const one = coordinator.request("sidebar");
  coordinator.takeNext();
  const two = coordinator.request("sidebar");
  const three = coordinator.request("sidebar");
  assert.equal(coordinator.isLatest(one), false);
  assert.equal(coordinator.isLatest(two), false);
  assert.equal(coordinator.isLatest(three), true);
  assert.deepEqual(coordinator.takeNext(), {
    generation: three,
    ingestDetectedTitles: true,
  });
});

test("repository feedback is coalesced and cannot re-ingest DOM titles", () => {
  const coordinator = new QuickAccessRefreshCoordinator();
  coordinator.request("repository");
  const latest = coordinator.request("repository");
  assert.deepEqual(coordinator.takeNext(), {
    generation: latest,
    ingestDetectedTitles: false,
  });
  assert.equal(coordinator.takeNext(), null);
});

test("repository feedback supersedes an active writer with one storage-only render", () => {
  const coordinator = new QuickAccessRefreshCoordinator();
  const writer = coordinator.request("sidebar");
  coordinator.takeNext();
  const feedback = coordinator.request("repository");
  assert.equal(coordinator.isLatest(writer), false);
  assert.deepEqual(coordinator.takeNext(), {
    generation: feedback,
    ingestDetectedTitles: false,
  });
});
