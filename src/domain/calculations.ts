import {
  countSchema,
  guestSchema,
  tableSchema,
  type Snapshot,
  type ValidationIssue,
} from "./models";
export function normalizeTableLabel(label: string) {
  const value = label.trim();
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, "") : value;
}
export function occupancy(snapshot: Snapshot, tableId: string) {
  return snapshot.guests
    .filter(
      (g) =>
        g.eventId === snapshot.event.id &&
        g.tableId === tableId &&
        g.attendance !== "declined",
    )
    .reduce((sum, g) => sum + g.size, 0);
}
export function calculateEventStats(s: Snapshot) {
  const guests = s.guests.filter((g) => g.eventId === s.event.id);
  const tables = s.tables.filter((t) => t.eventId === s.event.id);
  const ids = new Set(tables.map((t) => t.id));
  const sum = (items: typeof guests) => items.reduce((n, g) => n + g.size, 0);
  const planned = guests.filter((g) => g.attendance !== "declined");
  const assignedCount = sum(
    planned.filter((g) => g.tableId !== null && ids.has(g.tableId)),
  );
  const capacity = tables.reduce((n, t) => n + t.capacity, 0);
  return {
    totalRecordedCount: sum(guests),
    plannedCount: sum(planned),
    confirmedCount: sum(guests.filter((g) => g.attendance === "confirmed")),
    tentativeCount: sum(guests.filter((g) => g.attendance === "tentative")),
    declinedCount: sum(guests.filter((g) => g.attendance === "declined")),
    assignedCount,
    unassignedCount: sum(planned) - assignedCount,
    capacity,
    freeSeats: capacity - assignedCount,
    tableCount: tables.length,
    groupCount: guests.length,
  };
}
export function validateEvent(s: Snapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (
    code: string,
    message: string,
    entityId?: string,
    severity: "error" | "warning" = "error",
  ) => issues.push({ code, message, entityId, severity });
  const tableIds = new Set<string>();
  const labels = new Set<string>();
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const t of s.tables) {
    if (tableIds.has(t.id)) add("duplicate-table-id", "桌位 ID 重复", t.id);
    tableIds.add(t.id);
    if (!tableSchema.safeParse(t).success || t.eventId !== s.event.id)
      add("invalid-table", "桌位数据无效", t.id);
    const label = normalizeTableLabel(t.label);
    if (labels.has(label)) add("duplicate-label", `桌号 ${t.label} 重复`, t.id);
    labels.add(label);
    const used = occupancy(s, t.id);
    if (used > t.capacity)
      add("over-capacity", `${t.label} 桌超出 ${used - t.capacity} 席`, t.id);
  }
  for (const g of s.guests) {
    if (!guestSchema.safeParse(g).success || g.eventId !== s.event.id)
      add("invalid-guest", "宾客数据无效", g.id);
    if (ids.has(g.id)) add("duplicate-id", "宾客 ID 重复", g.id);
    ids.add(g.id);
    if (names.has(g.displayName.trim()))
      add(
        "duplicate-name",
        `“${g.displayName}”同名，保留独立记录`,
        g.id,
        "warning",
      );
    names.add(g.displayName.trim());
    if (
      g.tableId &&
      !s.tables.some((t) => t.id === g.tableId && t.eventId === g.eventId)
    )
      add("invalid-reference", "宾客指向不存在或其他活动的桌", g.id);
    if (g.attendance === "declined" && g.tableId)
      add("declined-assigned", "不参加的宾客仍有桌位", g.id);
    if (g.attendance !== "declined" && !g.tableId)
      add(
        "unassigned",
        `${g.displayName}：${g.size} 人未安排`,
        g.id,
        "warning",
      );
  }
  return issues;
}
export function assertCapacity(
  s: Snapshot,
  guestId: string,
  tableId: string | null,
  size: number,
  attendance: string,
) {
  if (!countSchema.safeParse(size).success)
    throw new Error("人数必须是 1–999 的整数");
  if (!tableId) return;
  const table = s.tables.find(
    (t) => t.id === tableId && t.eventId === s.event.id,
  );
  if (!table) throw new Error("目标桌不属于当前活动");
  if (attendance === "declined") throw new Error("不参加的宾客不能安排桌位");
  const used = s.guests
    .filter(
      (g) =>
        g.id !== guestId &&
        g.tableId === tableId &&
        g.attendance !== "declined",
    )
    .reduce((n, g) => n + g.size, 0);
  if (used + size > table.capacity)
    throw new Error(
      `目标桌将超出 ${used + size - table.capacity} 席，已阻止操作`,
    );
}

export function nextOrderIndex(items: { orderIndex: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.orderIndex), -1) + 1;
}
