import type { NativeConversationMenuActionKind } from "../../adapters/chatgpt/nativeConversationActions";

export interface FreshNativeActionRequest {
  conversationId: string;
  kind: NativeConversationMenuActionKind;
  requestId: number;
}

export class FreshNativeActionRequestController {
  private current: FreshNativeActionRequest | null = null;
  private nextRequestId = 1;

  public get activeState(): FreshNativeActionRequest | null {
    return this.current ? { ...this.current } : null;
  }

  public begin(
    conversationId: string,
    kind: NativeConversationMenuActionKind,
  ): FreshNativeActionRequest {
    this.current = { conversationId, kind, requestId: this.nextRequestId++ };
    return { ...this.current };
  }

  public consumeForConversation(conversationId: string): FreshNativeActionRequest | null {
    if (!this.current || this.current.conversationId !== conversationId) {
      return null;
    }
    const request = this.current;
    this.current = null;
    return { ...request };
  }

  public clear(requestId?: number): FreshNativeActionRequest | null {
    if (!this.current || (requestId !== undefined && this.current.requestId !== requestId)) {
      return null;
    }
    const request = this.current;
    this.current = null;
    return { ...request };
  }
}
