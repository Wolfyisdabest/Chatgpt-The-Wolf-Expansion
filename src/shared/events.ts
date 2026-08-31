export function debounce(callback: () => void, delayMs: number): () => void {
  let timeoutId: number | undefined;

  return () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = undefined;
      callback();
    }, delayMs);
  };
}

export class TypedEvent<T> {
  private readonly listeners = new Set<(event: T) => void>();

  public subscribe(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
