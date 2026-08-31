# ChatGPT: The Wolf Expansion

ChatGPT: The Wolf Expansion is a free, open-source Firefox and Floorp extension that adds missing power-user features to ChatGPT while preserving ChatGPT's normal interface.

> **Development status:** `v0.1.0-dev.5`. This is an early development build intended for manual testing. ChatGPT's DOM changes frequently, so integrations may need ongoing adapter updates.

This project is unofficial and is not affiliated with, endorsed by, or sponsored by OpenAI.

## Implemented in v0.1.0-dev.5

- An extension-owned Favorites system with no artificial pin limit.
- Favorites stored locally by stable ChatGPT conversation ID.
- A native-looking, collapsible Favorites section in the ChatGPT sidebar.
- Persistent favorite order with drag-and-drop and accessible move-up/move-down controls.
- Per-conversation add/remove star actions using one sidebar-scoped click path and exact live-row target resolution.
- Multi-strategy, normal-layout row integration that places the Wolf star before native Pin/menu controls or in a stable row-owned sibling slot.
- Explicit transient opener tracking for sidebar conversation menus rendered in ChatGPT portals.
- A separately classified Favorite action in the current conversation's top-right overflow menu.
- Plain conversation-identity normalization shared by sidebar inputs, with safe title fallback and strict `/c/<id>` validation.
- Explicit sidebar add/remove operations so their state, intent, storage operation, and reconciliation can be diagnosed independently.
- Automatic title refresh when a favorite appears in the visible ChatGPT sidebar with a newer title.
- A lightweight in-ChatGPT settings dialog, opened from the subtle **Wolf Expansion ⚙** sidebar entry.
- A browser-native options page retained as a fallback; both settings interfaces use the same service and storage record.
- Local debug logging, disabled by default and configurable from either settings interface.
- A temporary debug-only **Debug: Favorite/Unfavorite current chat** control that isolates repository/storage/rendering from row targeting.
- A feature lifecycle that removes Favorites UI and observers when Favorites is disabled without deleting saved data.
- A centralized ChatGPT DOM adapter so feature modules do not depend on ChatGPT's generated CSS class names.
- Versioned, namespaced `storage.local` data with defensive normalization and migration hooks.

No AI, sync, native companion, folders, tags, notes, or other later-roadmap features are implemented yet. See [ROADMAP.md](ROADMAP.md) for the locked long-term direction.

## Browser support

- Firefox 128 or newer
- Floorp versions based on Firefox 128 or newer

Chromium browsers are not supported in this milestone.

## Development setup

Requirements:

- Node.js 20 or newer
- npm

Install the development dependencies and build the extension:

```bash
npm install
npm run typecheck
npm test
npm run build
```

The unpacked development extension is generated in `dist/`. Node.js and npm are development tools only; the built extension has no external runtime or CDN dependencies.

For automatic TypeScript rebuilds during development:

```bash
npm run watch
```

Static manifest or options-page changes are also copied while the watcher is running.

## Load in Firefox or Floorp

1. Run `npm install` and `npm run build`.
2. Open `about:debugging`.
3. Select **This Firefox**.
4. Select **Load Temporary Add-on…**.
5. Choose `dist/manifest.json`.
6. Open or reload [chatgpt.com](https://chatgpt.com/).

Temporary extensions are removed when the browser exits. Rebuild and use **Reload** on the extension entry after source changes.

Open settings directly from the **Wolf Expansion ⚙** entry in ChatGPT's sidebar. The fallback page remains available from **Add-ons and themes** → **Extensions** → **ChatGPT: The Wolf Expansion** → **Preferences**.

## Manual Favorites test

1. Open ChatGPT with several conversations visible in the sidebar.
2. Hover or keyboard-focus a conversation row and activate its `☆` button.
3. Confirm the conversation appears immediately under **★ Favorites**.
4. Open both a sidebar row's `…` menu and the current conversation's top-right `…` menu; confirm each has the matching Wolf Favorite action.
5. Enable debug logging to expose the temporary current-chat Favorite/Unfavorite control and detailed row/menu classification logs.
6. Drag favorites to reorder them, click the visible arrow controls, or focus a control and use Enter/Space. A focused matching `ArrowUp`/`ArrowDown` control also reorders without installing a global shortcut.
7. Reload ChatGPT and restart Firefox/Floorp to confirm favorites and ordering persist.
8. Change settings from both the in-ChatGPT dialog and Add-ons Preferences and confirm ChatGPT updates without reinstalling.
9. Disable Favorites and confirm its UI disappears while saved Favorites return when re-enabled.

Removing a Wolf Expansion favorite never deletes or changes the underlying ChatGPT conversation or ChatGPT's native pin state.

## Architecture

The project uses strict TypeScript, native DOM APIs, CSS, Firefox WebExtension APIs, and esbuild. Runtime code is split into:

- `src/adapters/chatgpt/` — all ChatGPT-specific DOM discovery and SPA observation.
- `src/core/` — app startup, logging, and feature lifecycle.
- `src/storage/` — namespaced schemas, storage access, validation, and migrations.
- `src/settings/` — the shared typed settings service and browser-native options page.
- `src/features/settings/` — the lightweight in-ChatGPT settings frontend.
- `src/features/favorites/` — Favorites repository, sidebar, menu integration, and lifecycle.

Current storage keys are:

- `wolfExpansion.schemaVersion`
- `wolfExpansion.settings`
- `wolfExpansion.favorites`
- `wolfExpansion.uiState`

## Privacy and security

- No telemetry, analytics, ads, subscriptions, or paid features.
- No extension account and no cloud service.
- No cookie, token, or browser-history access.
- No private or undocumented ChatGPT APIs.
- No remote scripts or runtime network dependencies.
- Host access is limited to `https://chatgpt.com/*`.
- Extension data remains in Firefox `storage.local` unless a future, explicitly enabled export or sync feature is added.
- Favorites, ordering, collapse state, and settings do not use ChatGPT storage, `window.localStorage`, `sessionStorage`, or the browser/site cache. Clearing ordinary ChatGPT site data or cache is not intended to clear extension storage. Explicitly clearing extension data or uninstalling the extension can remove it.

## Known limitations

- ChatGPT may change its sidebar or menu DOM. The adapter fails safely and keeps stored metadata untouched, but UI integration can temporarily stop appearing until selectors are updated.
- Row integration first targets native Pin/menu controls and then falls back to a smaller unambiguous row-owned sibling slot. It never uses fixed screen coordinates or overlays native controls.
- Menu integration requires either an exact sidebar-row opener identity or an overflow-style current-conversation opener on a real `/c/<id>` page. Other ChatGPT menus remain untouched.
- A conversation deleted on ChatGPT remains in local Favorites because absence from the visible sidebar is not proof of deletion. Opening it may lead to ChatGPT's missing-conversation page; it can still be removed locally.
- Favorites titles update only from conversation links ChatGPT currently exposes in the sidebar.
- The sidebar add-payload correction in `v0.1.0-dev.5` passes automated identity-normalization, non-cloneable-extra, add/remove/re-add, parser, state, repository, and render-projection tests. Sidebar star and sidebar-menu behavior still require signed-in Firefox/Floorp live verification.

## License

Copyright © 2026 Wolfy and contributors.

This project is licensed under the GNU General Public License version 3 only. See [LICENSE](LICENSE).
