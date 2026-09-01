# ChatGPT: The Wolf Expansion

ChatGPT: The Wolf Expansion is a free, open-source Firefox and Floorp extension that adds missing power-user features to ChatGPT while preserving ChatGPT's normal interface.

> **Development status:** `v0.1.0-dev.7.2` — Quick Access Polish & Unified Behavior. This is an early development build intended for manual testing. ChatGPT's DOM changes frequently, so integrations may need ongoing adapter updates.

This project is unofficial and is not affiliated with, endorsed by, or sponsored by OpenAI.

## Implemented in v0.1.0-dev.7.2

- An unlimited extension-owned **Quick Access** system, internally backed by the proven Favorites repository and stable ChatGPT conversation IDs.
- One native-looking sidebar section containing nested folders, filed conversations, and loose Quick Access conversations. Folders are locations inside Quick Access, not a separate user-facing system.
- One Wolf-owned sidebar block keeps **Wolf Expansion settings** above **Quick Access**, and places both immediately before ChatGPT's complete native Pinned section. Quick Access expansion remains independently owned by `wolfExpansion.quickAccessUiState`.
- Coordinated membership behavior: assigning any native conversation to a folder automatically adds it to Quick Access; moving it to the root preserves Quick Access; removing it from Quick Access also removes its folder assignment.
- A hard folders-above-chats ordering rule at the root and inside every folder, with separate manual ordering regions.
- Native drag/drop for ChatGPT Recent-chat rows into folders, Quick Access chats into folders, folder chats between folders, folder nesting, root movement, and sibling/chat reordering.
- Keyboard-accessible folder controls for New subfolder, Rename, Move into, Move to parent/root, Move up/down, and safe Delete.
- Stabilized shared create/rename editing with runtime draft state, Enter/Escape handling, deterministic blur behavior, reconciliation-safe editor reuse, and narrowly scoped event/focus protection from ChatGPT's composer.
- Sidebar typography and editor density inherit ChatGPT's surrounding font metrics; nested depth changes indentation, never text size.
- Compact and Full item-name modes shared by both settings frontends. Compact names stay single-line and reveal genuine overflow on hover; Full names wrap safely.
- Outline/filled star actions for adding/removing the exact sidebar conversation from Quick Access without affecting ChatGPT's native Pin.
- Combined Quick Access and folder actions in both exact sidebar portal-menu contexts and strict current-conversation `/c/<id>` contexts.
- Local original monochrome SVG icons using `currentColor`; no emoji icon set, remote assets, or runtime icon dependency.
- Presentation-only deduplication: a Quick Access conversation assigned to a visible folder appears inside that folder without losing Quick Access state.
- Shared Quick Access and subordinate Folders settings in both the in-ChatGPT dialog and Firefox/Floorp Add-ons Preferences. Disabling Folders flattens starred chats without deleting membership; disabling Quick Access hides the whole organization system without deleting data.
- Plain conversation-identity normalization before every repository/storage handoff, including native-row drag payloads.
- Automatic visible-title refresh, persistent ordering/collapse state, safe folder deletion, typed events, debug logging, and feature lifecycle cleanup.
- A centralized ChatGPT DOM adapter, versioned namespaced `storage.local` data, and defensive migrations.

No AI, sync, native companion, tags, notes, Trash, or other later-roadmap features are implemented yet. See [ROADMAP.md](ROADMAP.md) for the locked long-term direction.

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

Open settings directly from the **Wolf Expansion** settings entry in ChatGPT's sidebar. The fallback page remains available from **Add-ons and themes** → **Extensions** → **ChatGPT: The Wolf Expansion** → **Preferences**.

## Manual Quick Access test

1. Test all four native **Pinned** / Wolf **Quick Access** expanded and collapsed combinations. Confirm each section retains its own state and the order remains **Wolf Expansion settings → Quick Access → Pinned → native history**.
2. Add a native conversation with its star, then drag another unstarred native conversation directly into a folder. Confirm both enter Quick Access and render once.
3. Move a foldered chat to Quick Access root, then unstar a foldered chat. Confirm the first keeps Quick Access membership while the second disappears from Wolf UI and leaves the native ChatGPT chat untouched.
4. Switch between Compact and Full item-name modes using both settings frontends. Verify long folder/chat names scroll only when clipped in Compact mode and wrap safely in Full mode.
5. Enable reduced motion and verify title scrolling and expand/drag transitions stop without changing functionality.
6. Drag over folders and insertion boundaries; confirm only the current folder highlight or insertion line appears and no blank gaps remain afterward.
7. Disable Folders and confirm all starred chats appear flat at the root; re-enable it and confirm stored locations return. Disable Quick Access and confirm the entire Wolf organization UI hides without data loss.
8. Recheck folder creation/rename protection, folders-before-chats ordering, cycle prevention, both conversation-menu contexts, native Pin independence, and persistence after reload.

Folder metadata lives in extension `storage.local`. Clearing ordinary ChatGPT site data or browser cache is not intended to remove it; explicitly clearing extension data or uninstalling the extension can.

## Architecture

The project uses strict TypeScript, native DOM APIs, CSS, Firefox WebExtension APIs, and esbuild. Runtime code is split into:

- `src/adapters/chatgpt/` — all ChatGPT-specific DOM discovery and SPA observation.
- `src/core/` — app startup, logging, and feature lifecycle.
- `src/storage/` — namespaced schemas, storage access, validation, and migrations.
- `src/settings/` — the shared typed settings service and browser-native options page.
- `src/features/settings/` — the lightweight in-ChatGPT settings frontend.
- `src/features/favorites/` — the preserved internal Favorites/Quick Access repository and identity events.
- `src/features/folders/` — the preserved folder repository and hierarchy rules.
- `src/features/quickAccess/` — unified projection, sidebar, drag/drop, menu integration, and lifecycle.

Current storage keys are:

- `wolfExpansion.schemaVersion`
- `wolfExpansion.settings`
- `wolfExpansion.favorites`
- `wolfExpansion.uiState`
- `wolfExpansion.folders`
- `wolfExpansion.folderMembership`
- `wolfExpansion.foldersUiState`
- `wolfExpansion.quickAccessUiState`

## Privacy and security

- No telemetry, analytics, ads, subscriptions, or paid features.
- No extension account and no cloud service.
- No cookie, token, or browser-history access.
- No private or undocumented ChatGPT APIs.
- No remote scripts or runtime network dependencies.
- Host access is limited to `https://chatgpt.com/*`.
- Extension data remains in Firefox `storage.local` unless a future, explicitly enabled export or sync feature is added.
- Quick Access, folders, ordering, collapse state, and settings do not use ChatGPT storage, `window.localStorage`, `sessionStorage`, or the browser/site cache. Clearing ordinary ChatGPT site data or cache is not intended to clear extension storage. Explicitly clearing extension data or uninstalling the extension can remove it.

## Known limitations

- ChatGPT may change its sidebar or menu DOM. The adapter fails safely and keeps stored metadata untouched, but UI integration can temporarily stop appearing until selectors are updated.
- Row integration first targets native Pin/menu controls and then falls back to a smaller unambiguous row-owned sibling slot. It never uses fixed screen coordinates or overlays native controls.
- Menu integration requires either an exact sidebar-row opener identity or an overflow-style current-conversation opener on a real `/c/<id>` page. Other ChatGPT menus remain untouched.
- A conversation deleted on ChatGPT remains in local Quick Access/folder metadata because absence from the visible sidebar is not proof of deletion. Opening it may lead to ChatGPT's missing-conversation page; it can still be removed locally.
- Conversation titles update only from links ChatGPT currently exposes in the native sidebar.
- Native Pinned-relative placement, long-name hover reveal, Full-mode wrapping, expand/collapse polish, and simplified drag indicators in dev.7.2 require signed-in Firefox/Floorp live verification.
- This milestone assigns each conversation to at most one folder. Folder references do not hide or move ChatGPT's native Recent-chat row.

## License

Copyright © 2026 Wolfy and contributors.

This project is licensed under the GNU General Public License version 3 only. See [LICENSE](LICENSE).
