export interface Feature {
  readonly id: string;
  enable(): Promise<void> | void;
  disable(): Promise<void> | void;
  destroy(): Promise<void> | void;
}

export interface Disposable {
  dispose(): void;
}

export type Unsubscribe = () => void;
