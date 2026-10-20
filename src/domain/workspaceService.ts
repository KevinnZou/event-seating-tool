import { repository, type Repository } from "../db/repository";
import { fingerprint, parseSnapshot, planMove, splitSizes } from "./snapshots";
import { nextOrderIndex } from "./calculations";
import type { Snapshot, Attendance } from "./types";
// All multi-record commands use the same transaction as their validation read.
export class WorkspaceService {
  readonly repo: Repository;
  constructor(repo = repository) {
    this.repo = repo;
  }
  async replace(s: Snapshot) {
    const safe = parseSnapshot(s),
      d = this.repo.database;
    // Keep this primitive atomic even when called outside a command transaction.
    // Dexie reuses a compatible parent transaction for import/history/restore.
    await this.repo.transaction(async () => {
      await d.guests.where("eventId").equals(safe.event.id).delete();
      await d.seatingTables.where("eventId").equals(safe.event.id).delete();
      await d.events.put({
        ...safe.event,
        updatedAt: new Date().toISOString(),
      });
      await d.guests.bulkAdd(safe.guests);
      await d.seatingTables.bulkAdd(safe.tables);
    });
  }
  move(eventId: string, ids: string[], target: string | null) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      await this.replace(planMove(s, ids, target));
    });
  }
  releaseTable(eventId: string, tableId: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const table = s.tables.find((t) => t.id === tableId);
      if (!table) throw new Error("桌位不属于当前活动");
      if (table.locked) throw new Error("请先解锁桌位");
      const ids = s.guests
        .filter((g) => g.tableId === tableId)
        .map((g) => g.id);
      if (ids.length) await this.replace(planMove(s, ids, null));
    });
  }
  swap(eventId: string, a: string, b: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      if (a === b || ![a, b].every((id) => s.tables.some((t) => t.id === id)))
        throw new Error("请选择两张不同的桌");
      if (s.tables.some((t) => [a, b].includes(t.id) && t.locked))
        throw new Error("请先解锁桌位");
      await this.replace({
        ...s,
        guests: s.guests.map((g) => ({
          ...g,
          tableId: g.tableId === a ? b : g.tableId === b ? a : g.tableId,
        })),
      });
    });
  }
  reorder(eventId: string, tableId: string, direction: -1 | 1) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId),
        index = s.tables.findIndex((t) => t.id === tableId),
        target = index + direction;
      if (index < 0 || target < 0 || target >= s.tables.length)
        throw new Error("无法继续移动");
      if (s.tables[index].locked || s.tables[target].locked)
        throw new Error("请先解锁相关桌位");
      const ordered = [...s.tables];
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      await this.replace({
        ...s,
        tables: ordered.map((t, i) => ({ ...t, orderIndex: i })),
      });
    });
  }
  batchAttendance(eventId: string, ids: string[], attendance: Attendance) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      planMove(s, ids, null);
      await this.replace({
        ...s,
        guests: s.guests.map((g) =>
          ids.includes(g.id)
            ? {
                ...g,
                attendance,
                tableId: attendance === "declined" ? null : g.tableId,
              }
            : g,
        ),
      });
    });
  }
  batchDelete(eventId: string, ids: string[]) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      planMove(s, ids, null);
      if (
        s.guests.some(
          (g) =>
            g.originGroupId &&
            ids.includes(g.originGroupId) &&
            !ids.includes(g.id),
        )
      )
        throw new Error("此组有拆分来源关联，请同时选择关联组");
      await this.replace({
        ...s,
        guests: s.guests.filter((g) => !ids.includes(g.id)),
      });
    });
  }
  split(
    eventId: string,
    id: string,
    segments: { name: string; size: number }[],
  ) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId),
        g = s.guests.find((g) => g.id === id);
      if (
        !g ||
        !splitSizes(
          g.size,
          segments.map((p) => p.size),
        )
      )
        throw new Error("至少拆成两组且人数合计必须与原组相同");
      if (s.tables.some((t) => t.id === g.tableId && t.locked))
        throw new Error("请先解锁桌位");
      const createdAt = new Date().toISOString();
      const first = {
        ...g,
        displayName: segments[0].name.trim(),
        size: segments[0].size,
        updatedAt: createdAt,
      };
      const rest = segments.slice(1).map((p, i) => ({
        ...g,
        id: crypto.randomUUID(),
        displayName: p.name.trim(),
        size: p.size,
        originGroupId: g.id,
        orderIndex: nextOrderIndex(s.guests) + i,
        createdAt,
        updatedAt: createdAt,
      }));
      await this.replace({
        ...s,
        guests: [
          ...s.guests.map((item) => (item.id === g.id ? first : item)),
          ...rest,
        ],
      });
    });
  }
  async restoreExpected(eventId: string, expected: Snapshot, target: Snapshot) {
    return this.repo.transaction(async () => {
      if (
        fingerprint(await this.repo.snapshot(eventId)) !== fingerprint(expected)
      )
        throw new Error(
          "数据已被其他操作或标签页修改，不能覆盖撤销；请重新核对",
        );
      await this.replace(target);
      return this.repo.snapshot(eventId);
    });
  }
}
export const workspaceService = new WorkspaceService();
