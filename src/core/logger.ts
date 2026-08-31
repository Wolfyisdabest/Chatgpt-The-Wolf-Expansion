export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
}

export class ConsoleLogger implements Logger {
  public constructor(private debugEnabled = false) {}

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  public debug(message: string, ...details: unknown[]): void {
    if (this.debugEnabled) {
      console.debug(`[Wolf Expansion] ${message}`, ...details);
    }
  }

  public warn(message: string, ...details: unknown[]): void {
    console.warn(`[Wolf Expansion] ${message}`, ...details);
  }

  public error(message: string, ...details: unknown[]): void {
    console.error(`[Wolf Expansion] ${message}`, ...details);
  }
}
