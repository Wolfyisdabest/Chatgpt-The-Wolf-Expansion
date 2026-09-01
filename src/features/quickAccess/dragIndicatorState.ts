export class ExclusiveDragIndicator<T> {
  private active: T | null = null;

  public get current(): T | null {
    return this.active;
  }

  public activate(target: T): T | null {
    const previous = this.active;
    this.active = target;
    return previous === target ? null : previous;
  }

  public clear(target?: T): T | null {
    if (target !== undefined && this.active !== target) {
      return null;
    }
    const previous = this.active;
    this.active = null;
    return previous;
  }
}
