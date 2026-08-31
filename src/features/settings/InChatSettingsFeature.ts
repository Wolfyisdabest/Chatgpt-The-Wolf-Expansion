import type { ChatGPTAdapter } from "../../adapters/chatgpt/ChatGPTAdapter";
import type { Logger } from "../../core/logger";
import { debounce } from "../../shared/events";
import { createWolfElement } from "../../shared/dom";
import type { Feature, Unsubscribe } from "../../shared/types";
import { SettingsService } from "../../settings/settings";
import type { WolfExpansionSettings } from "../../storage/schemas";

export class InChatSettingsFeature implements Feature {
  public readonly id = "in-chat-settings";

  private enabled = false;
  private settings: WolfExpansionSettings | null = null;
  private entry: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private opener: HTMLElement | null = null;
  private stopWatchingSidebar: Unsubscribe | null = null;
  private readonly scheduleReconcile: () => void;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly settingsService: SettingsService,
    private readonly logger: Logger,
  ) {
    this.scheduleReconcile = debounce(() => this.reconcile(), 100);
  }

  public setSettings(settings: WolfExpansionSettings): void {
    this.settings = settings;
    this.renderFormValues();
  }

  public enable(): void {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.stopWatchingSidebar = this.adapter.watchSidebar(this.scheduleReconcile);
    this.reconcile();
    this.logger.debug("In-ChatGPT settings enabled.");
  }

  public disable(): void {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.stopWatchingSidebar?.();
    this.stopWatchingSidebar = null;
    this.close();
    this.entry?.remove();
    this.entry = null;
    this.logger.debug("In-ChatGPT settings disabled.");
  }

  public destroy(): void {
    this.disable();
  }

  private reconcile(): void {
    if (!this.enabled) {
      return;
    }

    const target = this.adapter.findSidebarInsertionTarget();
    if (!target) {
      return;
    }

    if (!this.entry) {
      this.entry = createWolfElement("div", "settings-entry");
      this.entry.className = "wolf-settings-entry";

      const button = createWolfElement("button", "open-settings");
      button.type = "button";
      button.className = "wolf-open-settings";
      button.setAttribute("aria-label", "Open Wolf Expansion settings");

      const label = document.createElement("span");
      label.textContent = "Wolf Expansion";
      const icon = document.createElement("span");
      icon.textContent = "⚙";
      icon.setAttribute("aria-hidden", "true");
      button.append(label, icon);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        this.open(button);
      });
      this.entry.append(button);
    }

    const favoritesSection = Array.from(target.parent.children).find(
      (element) => element.getAttribute("data-wolf-expansion") === "favorites-section",
    ) ?? null;
    const before = favoritesSection ?? target.before;
    if (this.entry.parentElement !== target.parent || this.entry.nextElementSibling !== before) {
      target.parent.insertBefore(this.entry, before);
    }
  }

  private open(opener: HTMLElement): void {
    if (this.overlay) {
      this.overlay.querySelector<HTMLElement>(".wolf-settings-dialog")?.focus();
      return;
    }

    this.opener = opener;
    const overlay = createWolfElement("div", "settings-overlay");
    overlay.className = "wolf-settings-overlay";
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) {
        this.close();
      }
    });

    const dialog = createWolfElement("section", "settings-dialog");
    dialog.className = "wolf-settings-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "wolf-settings-title");
    dialog.tabIndex = -1;

    const header = document.createElement("header");
    header.className = "wolf-settings-dialog-header";
    const title = document.createElement("h2");
    title.id = "wolf-settings-title";
    title.textContent = "Wolf Expansion Settings";
    const closeButton = createWolfElement("button", "close-settings");
    closeButton.type = "button";
    closeButton.className = "wolf-settings-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close Wolf Expansion settings");
    closeButton.addEventListener("click", () => this.close());
    header.append(title, closeButton);

    const form = createWolfElement("form", "settings-form");
    form.className = "wolf-settings-form";
    form.append(
      this.createSettingsGroup("General", [
        this.createCheckbox("wolf-settings-enabled", "Enable Wolf Expansion"),
        this.createCheckbox("wolf-settings-debug", "Debug logging"),
      ]),
      this.createSettingsGroup("Favorites", [
        this.createCheckbox("wolf-settings-favorites-enabled", "Enable Favorites"),
        this.createCheckbox("wolf-settings-show-icon", "Show Favorites icon"),
        this.createCheckbox(
          "wolf-settings-remember-collapsed",
          "Remember collapsed state",
        ),
      ]),
    );
    form.addEventListener("change", () => {
      void this.saveForm();
    });

    const status = createWolfElement("p", "settings-status");
    status.className = "wolf-settings-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    dialog.append(header, form, status);
    dialog.addEventListener("keydown", (event) => this.handleDialogKeydown(event));
    overlay.append(dialog);
    document.body.append(overlay);
    this.overlay = overlay;
    this.renderFormValues();
    dialog.focus();
  }

  private close(): void {
    this.overlay?.remove();
    this.overlay = null;
    if (this.opener?.isConnected) {
      this.opener.focus({ preventScroll: true });
    }
    this.opener = null;
  }

  private createSettingsGroup(title: string, rows: HTMLElement[]): HTMLFieldSetElement {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = title;
    fieldset.append(legend, ...rows);
    return fieldset;
  }

  private createCheckbox(id: string, labelText: string): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "wolf-settings-row";
    const text = document.createElement("span");
    text.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = "checkbox";
    label.append(text, input);
    return label;
  }

  private renderFormValues(): void {
    if (!this.overlay || !this.settings) {
      return;
    }

    this.setCheckbox("wolf-settings-enabled", this.settings.enabled);
    this.setCheckbox("wolf-settings-debug", this.settings.debug.enabled);
    this.setCheckbox("wolf-settings-favorites-enabled", this.settings.favorites.enabled);
    this.setCheckbox("wolf-settings-show-icon", this.settings.favorites.showIcon);
    this.setCheckbox(
      "wolf-settings-remember-collapsed",
      this.settings.favorites.rememberCollapsed,
    );
  }

  private async saveForm(): Promise<void> {
    try {
      this.settings = await this.settingsService.update({
        enabled: this.getCheckbox("wolf-settings-enabled"),
        debug: {
          enabled: this.getCheckbox("wolf-settings-debug"),
        },
        favorites: {
          enabled: this.getCheckbox("wolf-settings-favorites-enabled"),
          showIcon: this.getCheckbox("wolf-settings-show-icon"),
          rememberCollapsed: this.getCheckbox("wolf-settings-remember-collapsed"),
        },
      });
      const status = this.overlay?.querySelector<HTMLElement>(
        '[data-wolf-expansion="settings-status"]',
      );
      if (status) {
        status.textContent = "Settings saved.";
      }
    } catch (error) {
      this.logger.error("Could not save in-ChatGPT settings.", error);
      const status = this.overlay?.querySelector<HTMLElement>(
        '[data-wolf-expansion="settings-status"]',
      );
      if (status) {
        status.textContent = "Could not save settings.";
      }
    }
  }

  private getCheckbox(id: string): boolean {
    const input = this.overlay?.querySelector<HTMLInputElement>(`#${id}`);
    return input?.checked ?? false;
  }

  private setCheckbox(id: string, checked: boolean): void {
    const input = this.overlay?.querySelector<HTMLInputElement>(`#${id}`);
    if (input) {
      input.checked = checked;
    }
  }

  private handleDialogKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== "Tab" || !this.overlay) {
      return;
    }

    const focusable = Array.from(
      this.overlay.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
