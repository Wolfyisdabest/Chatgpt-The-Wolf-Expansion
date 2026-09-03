# Sanitized ChatGPT Sidebar DOM Fixture

These files were produced from a signed-in ChatGPT DOM snapshot with **Wolf Expansion enabled**.

## Safe-to-keep changes

The fixture intentionally removes or anonymizes:

- all `<script>` / bootstrap content;
- ChatGPT access/session credentials;
- account/user identifiers;
- email/name data;
- real conversation IDs;
- real conversation titles;
- Wolf folder names/IDs;
- non-sidebar `main` content;
- hidden backend iframe content.

The UUID replacements are deterministic **within the fixture**, so relationships such as:

- `/c/<conversation-id>`
- `data-conversation-options-trigger="<conversation-id>"`
- `data-wolf-conversation-id="<conversation-id>"`
- `data-conversation-id="<conversation-id>"`

still match correctly.

## Important live structures preserved

The fixture retains real structural patterns observed in ChatGPT, including:

- native conversation links using `/c/<conversation-id>`;
- native overflow triggers using `data-conversation-options-trigger="<conversation-id>"`;
- native dedicated Pin buttons in the trailing action area;
- native `data-active=""` state on the current conversation;
- OpenAI sidebar section spacing using `--sidebar-expanded-section-margin-bottom`;
- Wolf Expansion sidebar root / Quick Access DOM;
- Wolf tree/folder/chat relationships and current injected attributes.

One literal test title, `Pinned: Test Chat`, is deliberately retained because it is a regression case for title-integrity logic.

One generic long title is deliberately retained for Compact hover-reveal testing.

## Limitation

The native ChatGPT conversation overflow menu was **closed** when the original DOM was captured.

Therefore these fixture files do **not** contain the dynamically mounted Radix menu items for:

- Rename
- Archive
- Delete
- other overflow-menu actions

Use the fixture to resolve the correct native row and native menu trigger, but do not invent exact menu-item markup from it.

If native action delegation still fails after fresh-menu reacquisition is implemented, capture a *separately sanitized* DOM snapshot while the native menu is open.

## Intended use

These files are structural/debug fixtures, not byte-for-byte browser snapshots. HTML serialization may normalize attribute ordering/casing.

They are suitable for Codex inspection and repository test-fixture/reference use.
