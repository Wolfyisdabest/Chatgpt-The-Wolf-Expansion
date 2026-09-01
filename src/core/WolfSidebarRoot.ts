import type { ChatGPTAdapter, SidebarInsertionTarget } from "../adapters/chatgpt/ChatGPTAdapter";
import {
  getWolfSlotInsertionIndex,
  type WolfSidebarSlot,
} from "../adapters/chatgpt/sidebarPlacement";
import { createWolfElement } from "../shared/dom";
import type { Logger } from "./logger";

export class WolfSidebarRoot {
  private root: HTMLElement | null = null;
  private readonly elements = new Map<WolfSidebarSlot, HTMLElement>();

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly logger: Logger,
  ) {}

  public mount(slot: WolfSidebarSlot, element: HTMLElement): boolean {
    const target = this.adapter.findSidebarInsertionTarget();
    if (!target) {
      return false;
    }

    const root = this.ensureRoot();
    const previous = this.elements.get(slot);
    if (previous && previous !== element) {
      previous.remove();
    }
    this.elements.set(slot, element);
    element.dataset.wolfSidebarSlot = slot;
    this.placeSlot(root, slot, element);
    this.reconcilePlacement(root, target);
    this.verifyOrder(root, target);
    return true;
  }

  public unmount(slot: WolfSidebarSlot, element: HTMLElement): void {
    if (this.elements.get(slot) === element) {
      this.elements.delete(slot);
    }
    element.remove();
    if (this.elements.size === 0) {
      this.root?.remove();
      this.root = null;
    }
  }

  public destroy(): void {
    this.elements.clear();
    this.root?.remove();
    this.root = null;
  }

  private ensureRoot(): HTMLElement {
    if (!this.root) {
      this.root = createWolfElement("div", "sidebar-root");
      this.root.className = "wolf-sidebar-root";
      this.root.setAttribute("aria-label", "Wolf Expansion sidebar tools");
    }
    return this.root;
  }

  private placeSlot(
    root: HTMLElement,
    slot: WolfSidebarSlot,
    element: HTMLElement,
  ): void {
    const existingSlots = Array.from(root.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== element)
      .map((child) => child.dataset.wolfSidebarSlot)
      .filter((value): value is WolfSidebarSlot =>
        value === "settings" || value === "quick-access");
    const insertionIndex = getWolfSlotInsertionIndex(existingSlots, slot);
    const before = Array.from(root.children)
      .filter((child) => child !== element)[insertionIndex] ?? null;
    if (element.parentElement !== root || element.nextElementSibling !== before) {
      root.insertBefore(element, before);
    }
  }

  private reconcilePlacement(root: HTMLElement, target: SidebarInsertionTarget): void {
    this.logger.debug("Sidebar placement reconcile.");
    if (target.placement === "before-pinned") {
      this.logger.debug("Native Pinned found.");
    }
    if (root.parentElement !== target.parent || root.nextElementSibling !== target.before) {
      target.parent.insertBefore(root, target.before);
      this.logger.debug(target.placement === "before-pinned"
        ? "Wolf root inserted before native Pinned."
        : "Wolf root inserted before native history fallback.");
    }
  }

  private verifyOrder(root: HTMLElement, target: SidebarInsertionTarget): void {
    const settings = this.elements.get("settings");
    const quickAccess = this.elements.get("quick-access");
    const settingsBeforeQuickAccess = !settings || !quickAccess ||
      (settings.compareDocumentPosition(quickAccess) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const rootBeforeNative = root.nextElementSibling === target.before;
    if (settingsBeforeQuickAccess && rootBeforeNative) {
      this.logger.debug("Sidebar order verified settings -> quick-access -> pinned/history.");
    } else {
      this.logger.warn("Wolf sidebar order verification failed; reconciliation will retry.");
    }
  }
}
