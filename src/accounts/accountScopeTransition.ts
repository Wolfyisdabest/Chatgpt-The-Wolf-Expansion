export class AccountScopeTransition {
  private generation = 0;
  private pending = true;

  public get isPending(): boolean {
    return this.pending;
  }

  public begin(): number {
    this.generation += 1;
    this.pending = true;
    return this.generation;
  }

  public isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  public complete(generation: number): boolean {
    if (!this.isCurrent(generation)) {
      return false;
    }
    this.pending = false;
    return true;
  }
}
