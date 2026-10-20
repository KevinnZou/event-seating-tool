import type { Snapshot } from "./models";
import type { Point, Venue } from "./venueModels";
export const TABLE_RADIUS = 48;
export function defaultPosition(index: number, width: number): Point {
  const columns = Math.max(1, Math.floor((width - 100) / 150));
  return {
    x: 100 + (index % columns) * 150,
    y: 160 + Math.floor(index / columns) * 150,
  };
}
export function layoutOf(s: Snapshot) {
  const width = s.event.venue?.width ?? 1200;
  const last = defaultPosition(Math.max(0, s.tables.length - 1), width);
  const venue: Venue = s.event.venue ?? {
    width,
    height: Math.max(800, last.y + 100),
    areas: [],
  };
  return {
    venue,
    tables: s.tables.map((table, i) => ({
      ...table,
      position: table.position ?? defaultPosition(i, width),
    })),
  };
}
export function clampPoint(
  point: Point,
  width: number,
  height: number,
  marginX = TABLE_RADIUS,
  marginY = marginX,
): Point {
  if (
    ![point.x, point.y, width, height, marginX, marginY].every(
      Number.isFinite,
    ) ||
    width < 2 * marginX ||
    height < 2 * marginY
  )
    throw new Error("坐标或边界无效");
  return {
    x: Math.round(Math.max(marginX, Math.min(width - marginX, point.x))),
    y: Math.round(Math.max(marginY, Math.min(height - marginY, point.y))),
  };
}
export function layoutErrors(s: Snapshot) {
  if (!s.event.venue)
    return s.tables.some((t) => t.position) ? ["桌位坐标缺少关联场地"] : [];
  const { venue, tables } = layoutOf(s);
  return tables
    .filter(
      (table) =>
        table.position.x < TABLE_RADIUS ||
        table.position.y < TABLE_RADIUS ||
        table.position.x + TABLE_RADIUS > venue.width ||
        table.position.y + TABLE_RADIUS > venue.height,
    )
    .map((table) => `${table.label} 桌超出场地边界，请扩大画布或调整坐标`);
}
export function layoutWarnings(s: Snapshot) {
  const { venue, tables } = layoutOf(s);
  const warnings: string[] = [];
  for (let i = 0; i < tables.length; i++) {
    const a = tables[i];
    for (const b of tables.slice(i + 1))
      if (
        Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) <
        TABLE_RADIUS * 2
      )
        warnings.push(`${a.label} 与 ${b.label} 桌重叠`);
    for (const area of venue.areas) {
      const x = Math.max(area.x, Math.min(area.x + area.width, a.position.x));
      const y = Math.max(area.y, Math.min(area.y + area.height, a.position.y));
      if (Math.hypot(a.position.x - x, a.position.y - y) < TABLE_RADIUS)
        warnings.push(`${a.label} 桌与“${area.label}”区域重叠`);
    }
  }
  return warnings;
}
export function materializeLayout(s: Snapshot): Snapshot {
  const { venue, tables } = layoutOf(s);
  return { ...s, event: { ...s.event, venue }, tables };
}
