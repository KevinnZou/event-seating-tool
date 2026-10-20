import { workspaceService, WorkspaceService } from "./workspaceService";
import type { Snapshot } from "./models";
import { fingerprint } from "./snapshots";
type Entry = { before: Snapshot; after: Snapshot };
export class HistoryService {
  readonly service: WorkspaceService;
  private stacks = new Map<string, { undo: Entry[]; redo: Entry[] }>();
  private listeners = new Set<() => void>();
  private revision = 0;
  constructor(service = workspaceService) {
    this.service = service;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getRevision = () => this.revision;
  private emit() {
    this.revision++;
    this.listeners.forEach((fn) => fn());
  }
  private stack(id: string) {
    if (!this.stacks.has(id)) this.stacks.set(id, { undo: [], redo: [] });
    return this.stacks.get(id)!;
  }
  canUndo(id: string) {
    return this.stack(id).undo.length > 0;
  }
  canRedo(id: string) {
    return this.stack(id).redo.length > 0;
  }
  async execute(id: string, action: () => Promise<unknown>) {
    let entry: Entry | undefined;
    await this.service.repo.transaction(async () => {
      const before = await this.service.repo.snapshot(id);
      await action();
      const after = await this.service.repo.snapshot(id);
      if (fingerprint(before) !== fingerprint(after)) entry = { before, after };
    });
    if (entry) {
      const stack = this.stack(id);
      stack.undo.push(entry);
      stack.undo = stack.undo.slice(-30);
      stack.redo = [];
      this.emit();
    }
  }
  async undo(id: string) {
    const stack = this.stack(id),
      entry = stack.undo.at(-1);
    if (!entry) return;
    const restored = await this.service.restoreExpected(
      id,
      entry.after,
      entry.before,
    );
    stack.undo.pop();
    const previous = stack.undo.at(-1);
    if (previous) previous.after = restored;
    stack.redo.push({ ...entry, before: restored });
    this.emit();
  }
  async redo(id: string) {
    const stack = this.stack(id),
      entry = stack.redo.at(-1);
    if (!entry) return;
    const restored = await this.service.restoreExpected(
      id,
      entry.before,
      entry.after,
    );
    stack.redo.pop();
    const next = stack.redo.at(-1);
    if (next) next.before = restored;
    stack.undo.push({ ...entry, after: restored });
    this.emit();
  }
  reset() {
    this.stacks.clear();
    this.emit();
  }
  clear(id: string) {
    this.stacks.delete(id);
    this.emit();
  }
}
export const historyService = new HistoryService();
