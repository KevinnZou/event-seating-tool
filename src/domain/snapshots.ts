import { z } from "zod";
import { eventSchema, guestSchema, tableSchema, type Snapshot } from "./models";
import { validateEvent } from "./calculations";
export const snapshotSchema = z.object({
  event: eventSchema,
  guests: z.array(guestSchema),
  tables: z.array(tableSchema),
});
export function parseSnapshot(input: unknown): Snapshot {
  const s = snapshotSchema.parse(input);
  const issues = validateEvent(s).filter((i) => i.severity === "error");
  if (
    s.guests.some(
      (g) =>
        g.originGroupId &&
        !s.guests.some((source) => source.id === g.originGroupId),
    )
  )
    throw new Error("分组来源引用无效");
  if (issues.length) throw new Error(issues.map((i) => i.message).join("；"));
  return s;
}
export function fingerprint(s: Snapshot) {
  const normalized = snapshotSchema.parse(s);
  return JSON.stringify({
    event: normalized.event,
    guests: normalized.guests.sort((a, b) => a.id.localeCompare(b.id)),
    tables: normalized.tables.sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export function planMove(
  s: Snapshot,
  ids: string[],
  target: string | null,
): Snapshot {
  const selected = new Set(ids);
  if (!selected.size) throw new Error("请先选择宾客组");
  if (
    selected.size !== ids.length ||
    ids.some((id) => !s.guests.some((g) => g.id === id))
  )
    throw new Error("选择包含无效宾客");
  if (target && !s.tables.some((t) => t.id === target))
    throw new Error("目标桌不属于当前活动");
  if (
    s.tables.some(
      (t) =>
        t.locked &&
        (t.id === target ||
          s.guests.some((g) => selected.has(g.id) && g.tableId === t.id)),
    )
  )
    throw new Error("请先解锁桌位");
  if (
    target &&
    s.guests.some((g) => selected.has(g.id) && g.attendance === "declined")
  )
    throw new Error("不参加的宾客不能安排桌位");
  const result = {
    ...s,
    guests: s.guests.map((g) =>
      selected.has(g.id) ? { ...g, tableId: target } : g,
    ),
  };
  parseSnapshot(result);
  return result;
}
export function splitSizes(total: number, sizes: number[]) {
  return (
    sizes.length >= 2 &&
    sizes.every((n) => Number.isInteger(n) && n > 0 && n <= 999) &&
    sizes.reduce((sum, n) => sum + n, 0) === total
  );
}
