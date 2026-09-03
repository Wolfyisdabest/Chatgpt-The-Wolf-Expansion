# Native ChatGPT Conversation Menu Fixture

This fixture was captured from a **real open ChatGPT conversation overflow menu**
while Wolf Expansion was enabled, then sanitized.

## Native menu structure observed

The native root is a Radix-style menu:

```html
<div role="menu" data-state="open" data-radix-menu-content ...>
```

Native actions are rendered as `div[role="menuitem"]`, not buttons.

Observed native actions in this capture:

- Share
- Rename
- Pin chat
- Archive
- Delete
- Move to project (submenu)

Important selectors/markers observed:

- menu root: `[role="menu"][data-radix-menu-content]`
- native items: `[role="menuitem"][data-radix-collection-item]`
- Share has `data-testid="share-chat-menu-item"`
- Delete has `data-testid="delete-chat-menu-item"`
- Rename, Pin chat, and Archive did **not** expose dedicated test IDs in this capture.
- Delete also has `data-color="danger"`.

## Wolf Expansion integration observed

Wolf Expansion appends its own menu region inside the same native menu root:

```html
<div data-wolf-expansion="quick-access-menu-actions" ...>
```

Therefore native-action discovery must explicitly exclude descendants of
`[data-wolf-expansion]` so Wolf's own proxy actions are never mistaken for
ChatGPT-native menu actions.

## Reacquisition rule

Do not cache native `HTMLElement` references between discovery and later user action.

For Rename / Archive / Delete:

1. Resolve the exact native conversation row fresh.
2. Resolve the exact native overflow trigger fresh.
3. Open a fresh native menu.
4. Resolve the currently connected menu root associated with that opener.
5. Enumerate fresh native menu items, excluding Wolf-owned descendants.
6. Classify by semantic action kind.
7. Require exactly one matching connected item.
8. Click it immediately.
9. Discard all native DOM references.

For Pin / Unpin, prefer the dedicated native row button when available instead of
opening the overflow menu.

## Sanitization

The fixture replaces:

- real conversation UUIDs;
- generated Radix IDs;
- Wolf folder names;
- capture-specific positioning values.

It preserves the actual structural attributes/classes relevant to adapter tests.

No login/session/bootstrap credentials are present in this fixture.
