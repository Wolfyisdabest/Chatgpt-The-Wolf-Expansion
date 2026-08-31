export type ConversationMenuKind = "sidebar-conversation" | "current-conversation";

export interface PendingMenuTarget<TConversation> {
  kind: ConversationMenuKind;
  conversation: TConversation;
  controlledElementId: string | null;
  openedAt: number;
}

export class TransientMenuTargetStore<TConversation> {
  private target: PendingMenuTarget<TConversation> | null = null;

  public constructor(private readonly maxAgeMs: number) {}

  public remember(target: PendingMenuTarget<TConversation>): void {
    this.target = target;
  }

  public current(now: number): PendingMenuTarget<TConversation> | null {
    if (!this.target) {
      return null;
    }

    if (now - this.target.openedAt > this.maxAgeMs) {
      this.target = null;
      return null;
    }

    return this.target;
  }

  public clear(): void {
    this.target = null;
  }
}
