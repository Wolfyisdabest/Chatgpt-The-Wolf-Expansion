export type LocalConversationMenuAvailability =
  | "loading"
  | "available"
  | "unavailable";

export interface LocalConversationMenuState {
  conversationId: string;
  nativeAvailability: LocalConversationMenuAvailability;
  requestId: number;
}

export class LocalConversationMenuController {
  private currentState: LocalConversationMenuState | null = null;
  private nextRequestId = 1;

  public get activeState(): LocalConversationMenuState | null {
    return this.currentState ? { ...this.currentState } : null;
  }

  public open(conversationId: string): LocalConversationMenuState {
    this.currentState = {
      conversationId,
      nativeAvailability: "loading",
      requestId: this.nextRequestId,
    };
    this.nextRequestId += 1;
    return { ...this.currentState };
  }

  public setNativeAvailability(
    requestId: number,
    availability: Exclude<LocalConversationMenuAvailability, "loading">,
  ): boolean {
    if (!this.currentState || this.currentState.requestId !== requestId) {
      return false;
    }
    this.currentState.nativeAvailability = availability;
    return true;
  }

  public close(requestId?: number): LocalConversationMenuState | null {
    if (
      !this.currentState ||
      (requestId !== undefined && this.currentState.requestId !== requestId)
    ) {
      return null;
    }
    const closed = this.currentState;
    this.currentState = null;
    return { ...closed };
  }
}

export interface AnchoredMenuPosition {
  left: number;
  top: number;
}

export function getAnchoredMenuPosition(
  anchor: { bottom: number; left: number; right: number; top: number },
  menu: { height: number; width: number },
  viewport: { height: number; width: number },
  gap = 4,
  edgePadding = 8,
): AnchoredMenuPosition {
  const preferredLeft = anchor.right - menu.width;
  const left = Math.min(
    Math.max(edgePadding, preferredLeft),
    Math.max(edgePadding, viewport.width - menu.width - edgePadding),
  );
  const fitsBelow = anchor.bottom + gap + menu.height <= viewport.height - edgePadding;
  const top = fitsBelow
    ? anchor.bottom + gap
    : Math.max(edgePadding, anchor.top - gap - menu.height);
  return { left, top };
}
