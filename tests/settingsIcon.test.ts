import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const suppliedIconPath = path.join(
  root,
  "assets/icons/Settings/settings_black.svg",
);
const adaptedIconPath = path.join(
  root,
  "assets/icons/Settings/settings_currentcolor.svg",
);

test("the supplied black settings gear is the local bundled source", () => {
  assert.equal(existsSync(suppliedIconPath), true);
  const svg = readFileSync(suppliedIconPath, "utf8");
  assert.match(svg, /viewBox="0 0 478\.703 478\.703"/);
  assert.match(svg, /<path d="M454\.2,189\.101/);
  assert.doesNotMatch(svg, /<script|<(?:image|use)\b[^>]+href=["']https?:\/\//iu);
});

test("the supplied gear is copied to dist and presented through currentColor", () => {
  const build = readFileSync(path.join(root, "scripts/build.mjs"), "utf8");
  const settingsFeature = readFileSync(
    path.join(root, "src/features/settings/InChatSettingsFeature.ts"),
    "utf8",
  );
  const css = readFileSync(
    path.join(root, "src/features/settings/in-chat-settings.css"),
    "utf8",
  );
  const adaptedSvg = readFileSync(adaptedIconPath, "utf8");
  assert.match(adaptedSvg, /fill="currentColor"/);
  assert.match(adaptedSvg, /<path d="M454\.2,189\.101/);
  assert.doesNotMatch(adaptedSvg, /<script|<!DOCTYPE|<(?:image|use)\b/iu);
  assert.match(build, /settings_currentcolor\.svg", "icons\/settings-gear\.svg"/);
  assert.match(settingsFeature, /browser\.runtime\.getURL\("icons\/settings-gear\.svg"\)/);
  assert.match(css, /\.wolf-settings-gear-icon\s*\{[^}]*background-color:\s*currentColor;[^}]*mask:/s);
  assert.doesNotMatch(settingsFeature, /createIcon\("settings"\)/);
});
