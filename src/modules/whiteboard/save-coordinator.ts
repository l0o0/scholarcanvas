import type { CanvasDocument } from "./snapshot";

export type WhiteboardSaveState = "saved" | "saving" | "error";

export interface WhiteboardSaveSnapshot {
  rev: number;
  document: CanvasDocument;
}

export interface WhiteboardSaveCoordinatorOptions {
  getSnapshot: () => WhiteboardSaveSnapshot | Promise<WhiteboardSaveSnapshot>;
  write: (snapshot: WhiteboardSaveSnapshot) => Promise<void>;
  onStateChange?: (state: WhiteboardSaveState) => void;
}

export class WhiteboardSaveCoordinator {
  currentRev = 0;
  savedRev = 0;
  writing = false;
  lastError: Error | undefined;

  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly options: WhiteboardSaveCoordinatorOptions) {}

  get dirty(): boolean {
    return this.currentRev > this.savedRev;
  }

  markChanged(rev: number): void {
    if (Number.isFinite(rev)) this.currentRev = Math.max(this.currentRev, rev);
  }

  request(options: { force?: boolean } = {}): Promise<void> {
    const save = this.tail.then(
      () => this.drain(Boolean(options.force)),
      () => this.drain(Boolean(options.force)),
    );
    this.tail = save.catch(() => undefined);
    return save;
  }

  async flush(): Promise<void> {
    await this.request();
  }

  private async drain(force: boolean): Promise<void> {
    if (!force && !this.dirty) return;

    this.writing = true;
    this.options.onStateChange?.("saving");
    try {
      do {
        const snapshot = await this.options.getSnapshot();
        this.currentRev = Math.max(this.currentRev, snapshot.rev);
        await this.options.write(snapshot);
        this.savedRev = Math.max(this.savedRev, snapshot.rev);
        force = false;
      } while (this.dirty);
      this.lastError = undefined;
      this.options.onStateChange?.("saved");
    } catch (error) {
      this.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.options.onStateChange?.("error");
      throw this.lastError;
    } finally {
      this.writing = false;
    }
  }
}
