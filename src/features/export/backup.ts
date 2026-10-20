import { z } from "zod";
import {
  eventSchema,
  guestSchema,
  tableSchema,
  type Snapshot,
} from "../../domain/models";
import { snapshotSchema, parseSnapshot } from "../../domain/snapshots";
export const checkpointSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  createdAt: z.string().datetime(),
  reason: z.enum(["import", "bulk-edit", "manual"]),
  snapshot: snapshotSchema,
});
export const bundleSchema = z
  .object({
    format: z.literal("event-seating-backup"),
    schemaVersion: z.literal(1),
    appVersion: z.literal("0.1.0"),
    exportedAt: z.string().datetime(),
    scope: z.enum(["all-events", "single-event"]),
    events: z.array(eventSchema).max(200),
    tables: z.array(tableSchema).max(20000),
    guestGroups: z.array(guestSchema).max(100000),
    checkpoints: z.array(checkpointSchema).max(1000).default([]),
  })
  .strict();
export type Backup = z.infer<typeof bundleSchema>;
export function parseBackup(input: unknown): Backup {
  const b = bundleSchema.parse(input);
  if (b.scope === "single-event" && b.events.length !== 1)
    throw new Error("单活动备份须包含一场活动");
  const ids = new Set<string>();
  for (const item of [
    ...b.events,
    ...b.tables,
    ...b.guestGroups,
    ...b.checkpoints,
  ]) {
    if (ids.has(item.id)) throw new Error("备份存在重复ID");
    ids.add(item.id);
  }
  const eventIds = new Set(b.events.map((e) => e.id));
  if (
    [...b.tables, ...b.guestGroups, ...b.checkpoints].some(
      (item) => !eventIds.has(item.eventId),
    )
  )
    throw new Error("备份存在孤立活动引用");
  for (const event of b.events)
    parseSnapshot({
      event,
      tables: b.tables.filter((t) => t.eventId === event.id),
      guests: b.guestGroups.filter((g) => g.eventId === event.id),
    });
  for (const cp of b.checkpoints) {
    if (cp.snapshot.event.id !== cp.eventId)
      throw new Error("检查点活动引用无效");
    parseSnapshot(cp.snapshot);
  }
  return b;
}
export function decodeBackup(text: string) {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error("备份文件上限10MB");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("JSON格式错误，未修改现有数据");
  }
  try {
    return parseBackup(input);
  } catch (e) {
    if (e instanceof z.ZodError)
      throw new Error("备份版本或字段无效，请使用本应用导出的V1备份", {
        cause: e,
      });
    throw e;
  }
}
export function remapBackup(input: Backup): Backup {
  const b = parseBackup(input),
    ids = new Map<string, string>();
  const remap = (id: string) => {
    if (!ids.has(id)) ids.set(id, crypto.randomUUID());
    return ids.get(id)!;
  };
  const snapshot = (s: Snapshot): Snapshot => ({
    event: { ...s.event, id: remap(s.event.id) },
    tables: s.tables.map((t) => ({
      ...t,
      id: remap(t.id),
      eventId: remap(t.eventId),
    })),
    guests: s.guests.map((g) => ({
      ...g,
      id: remap(g.id),
      eventId: remap(g.eventId),
      tableId: g.tableId ? remap(g.tableId) : null,
      originGroupId: g.originGroupId ? remap(g.originGroupId) : undefined,
    })),
  });
  const result = {
    ...b,
    events: b.events.map((e) => ({
      ...e,
      id: remap(e.id),
      name: `${e.name.slice(0, 90)}（恢复）`,
    })),
    tables: b.tables.map((t) => ({
      ...t,
      id: remap(t.id),
      eventId: remap(t.eventId),
    })),
    guestGroups: b.guestGroups.map((g) => ({
      ...g,
      id: remap(g.id),
      eventId: remap(g.eventId),
      tableId: g.tableId ? remap(g.tableId) : null,
      originGroupId: g.originGroupId ? remap(g.originGroupId) : undefined,
    })),
    checkpoints: b.checkpoints.map((cp) => ({
      ...cp,
      id: remap(cp.id),
      eventId: remap(cp.eventId),
      snapshot: snapshot(cp.snapshot),
    })),
  };
  return parseBackup(result);
}
