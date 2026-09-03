# ChatGPT Settings Dialog Fixture

This is a sanitized structural snapshot of ChatGPT's Settings dialog.

## Useful stable-ish anchors observed

Prefer semantic/data selectors such as:

- `[role="dialog"]` together with the visible `Settings` heading
- `[data-settings-tab-list="true"]`
- `[role="tablist"][aria-label="Settings"]`
- `[role="tab"]`
- `[role="tabpanel"]`
- `button[role="switch"]`
- `button[role="combobox"]`

## Do not depend on generated IDs

The live snapshot contained generated IDs such as Radix/internal `_r_...` IDs.
Those have been replaced in this fixture and should not be treated as stable
integration selectors.

## Styling guidance

The fixture is useful as a visual/structural reference, but Wolf Expansion
should not depend on copying ChatGPT's complete class strings. Prefer:

- Wolf-owned semantic markup and classes;
- ChatGPT CSS variables/tokens where safe;
- adapter-detected host surfaces;
- graceful fallback to the existing standalone Wolf settings surface if the
  native Settings integration cannot be resolved safely.

## Intended integration

A reasonable high-level flow is:

```text
Wolf sidebar settings shortcut
    -> open native ChatGPT Settings
    -> resolve Settings dialog
    -> resolve settings tab list / tablist
    -> inject Wolf-owned "Wolf Expansion" tab
    -> inject matching Wolf-owned tabpanel
    -> render existing SettingsService-backed controls
```

The Wolf tab/panel should be removable/re-created safely if ChatGPT re-renders
the dialog.

No authentication/session/bootstrap data is included in this fixture.
