import { repository, type Repository } from "../../db/repository";
import { CheckpointService } from "../../domain/checkpointService";
import { WorkspaceService } from "../../domain/workspaceService";
import { parseSnapshot, fingerprint } from "../../domain/snapshots";
import { normalizeTableLabel, nextOrderIndex } from "../../domain/calculations";
import type { Snapshot, GuestGroupEntity } from "../../domain/models";
import { rowErrors, type DraftRow } from "./parsers";
export function planImport(
  s: Snapshot,
  rows: DraftRow[],
  mode: "append" | "replace",
  createTables: boolean,
): Snapshot {
  if (rows.length > 5000) throw new Error("最多5000组");
  const chosen = rows.filter((r) => r.included);
  if (!chosen.length) throw new Error("没有选择可导入的记录");
  if (chosen.some((r) => rowErrors(r).length))
    throw new Error("请修复所有选中行的错误或明确取消勾选");
  if (
    mode === "replace" &&
    s.tables.some((t) => t.locked && s.guests.some((g) => g.tableId === t.id))
  )
    throw new Error("替换会影响锁定桌，请先解锁");
  const tables = [...s.tables];
  const guests = mode === "replace" ? [] : [...s.guests];
  for (const r of chosen) {
    let tableId: string | null = null;
    if (r.table) {
      let table = tables.find(
        (t) => normalizeTableLabel(t.label) === normalizeTableLabel(r.table),
      );
      if (!table) {
        if (!createTables)
          throw new Error(`未知桌号 ${r.table}：请选择自动建桌或清空候选桌号`);
        const timestamp = new Date().toISOString();
        table = {
          id: crypto.randomUUID(),
          eventId: s.event.id,
          label: r.table.trim(),
          capacity: s.event.defaultCapacity,
          orderIndex: nextOrderIndex(tables),
          locked: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        tables.push(table);
      }
      if (r.attendance === "declined")
        throw new Error(`第${r.line}行不参加，请清空桌号`);
      if (table.locked) throw new Error(`桌位 ${table.label} 已锁定`);
      tableId = table.id;
    }
    const timestamp = new Date().toISOString();
    guests.push({
      id: crypto.randomUUID(),
      eventId: s.event.id,
      displayName: r.name.trim(),
      size: Number(r.size),
      kind: "other",
      category: r.category,
      note: r.note,
      attendance: r.attendance as GuestGroupEntity["attendance"],
      tableId,
      orderIndex: nextOrderIndex(guests),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return parseSnapshot({ ...s, tables, guests });
}
export class ImportService {
  readonly repo: Repository;
  constructor(repo = repository) {
    this.repo = repo;
  }
  commit(
    eventId: string,
    rows: DraftRow[],
    mode: "append" | "replace",
    createTables: boolean,
    expected: string,
    confirmation: string,
  ) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      if (fingerprint(s) !== expected)
        throw new Error("活动已更改，请重新预览后导入");
      if (mode === "replace" && confirmation !== s.event.name)
        throw new Error("替换须输入完整活动名");
      const planned = planImport(s, rows, mode, createTables);
      await new CheckpointService(this.repo).create(eventId, "import");
      await new WorkspaceService(this.repo).replace(planned);
      return {
        added: rows.filter((r) => r.included).length,
        skipped: rows.filter((r) => !r.included).length,
        planned: planned.guests.reduce(
          (n, g) => n + (g.attendance === "declined" ? 0 : g.size),
          0,
        ),
      };
    });
  }
}
export const importService = new ImportService();
