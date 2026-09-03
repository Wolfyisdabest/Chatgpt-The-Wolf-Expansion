# Wolf Expansion — Sanitized ChatGPT DOM Fixtures

These files are structural fixtures for adapter development and regression tests.

## Commit these files, not the raw captures

The raw captures used to produce these fixtures can contain real account or
conversation information. Only the `.sanitized.html` files in this folder are
intended for the repository.

### Fixture set

- `chatgpt-sidebar-signed-in-body-outer.sanitized.html`
- `chatgpt-sidebar-signed-in-body-inner.sanitized.html`
- `chatgpt-native-conversation-menu-open.sanitized.html`
- `chatgpt-settings-dialog-general.sanitized.html`
- `chatgpt-profile-menu-open.sanitized.html`
- `chatgpt-logged-out-auth-controls.sanitized.html`
- `chatgpt-native-pinned-conversation-row.sanitized.html`
- `chatgpt-native-rename-editor.sanitized.html`
- `chatgpt-settings-account-panel.sanitized.html`
- `chatgpt-delete-confirmation-dialog.sanitized.html`
- `chatgpt-move-to-project-menu-stack.sanitized.html`

## Sanitized data

The fixture build removes or replaces, where present:

- executable/bootstrap scripts;
- real account names, usernames, email addresses and linked-profile handles;
- profile-image URLs carrying opaque account identifiers;
- signed or otherwise live image/file URLs, replaced with `example.invalid` placeholders;
- real conversation IDs and titles;
- real project IDs/names;
- Wolf folder names in captured menus;
- generated Radix/internal DOM IDs where useful.

## Adapter guidance

These snapshots describe current ChatGPT DOM structure, not a public API.
Prefer semantic/data anchors, require unique matches, and fail closed.
Do not depend on generated Radix IDs or complete utility-class strings.
`tests/fixturePrivacy.test.ts` audits the complete pack for obvious credential,
session, private-path, executable-capture, live-image, and identity regressions.


## Conversation / Composer Fixtures

See `CONVERSATION_COMPOSER_NOTES.md` for the second sanitized fixture batch covering messages, generated images, tool output, uploaded-file citations, attachments, composer states, and native search.
