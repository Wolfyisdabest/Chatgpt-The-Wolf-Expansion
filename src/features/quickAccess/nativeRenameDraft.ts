export interface NativeRenameDraftState {
  conversationId: string;
  draft: string | null;
  startedAt: number;
}

export class NativeRenameDraftController {
  private state: NativeRenameDraftState | null = null;

  public get activeState(): NativeRenameDraftState | null {
    return this.state ? { ...this.state } : null;
  }

  public begin(conversationId: string, startedAt = Date.now()): void {
    this.state = { conversationId, draft: null, startedAt };
  }

  public update(conversationId: string, draft: string): boolean {
    if (!this.state || this.state.conversationId !== conversationId) {
      return false;
    }
    this.state.draft = draft;
    return true;
  }

  public finish(conversationId: string): NativeRenameDraftState | null {
    if (!this.state || this.state.conversationId !== conversationId) {
      return null;
    }
    const finished = this.state;
    this.state = null;
    return { ...finished };
  }

  public clear(): void {
    this.state = null;
  }
}
