import { z } from "zod";
import type { Snapshot } from "./models";
import type { Point, VenueArea } from "./venueModels";
import {
  layoutOf,
  TABLE_RADIUS,
  clampPoint,
  defaultPosition,
} from "./geometry";
export const layoutOptionsSchema = z.object({
  columns: z.number().int().min(1).max(30),
  columnGap: z.number().int().min(0).max(1000),
  rowGap: z.number().int().min(0).max(1000),
  centralAisle: z.boolean(),
  aisleWidth: z.number().int().min(80).max(1000),
});
export type LayoutOptions = z.infer<typeof layoutOptionsSchema>;
export const defaultLayoutOptions: LayoutOptions = {
  columns: 4,
  columnGap: 54,
  rowGap: 54,
  centralAisle: true,
  aisleWidth: 120,
};
export const AREA_CLEARANCE = 24;
export function intersectsArea(point: Point, area: VenueArea, clearance = 0) {
  const x = Math.max(area.x, Math.min(area.x + area.width, point.x));
  const y = Math.max(area.y, Math.min(area.y + area.height, point.y));
  return Math.hypot(point.x - x, point.y - y) < TABLE_RADIUS + clearance;
}
function available(
  point: Point,
  placed: Point[],
  areas: VenueArea[],
  gap = 24,
) {
  return (
    !placed.some(
      (p) => Math.hypot(p.x - point.x, p.y - point.y) < TABLE_RADIUS * 2 + gap,
    ) && !areas.some((area) => intersectsArea(point, area, AREA_CLEARANCE))
  );
}
export function snapPoint(
  point: Point,
  width: number,
  height: number,
  step: number,
) {
  if (!Number.isInteger(step) || step < 1 || step > 1000)
    throw new Error("吸附步长无效");
  return clampPoint(
    {
      x: Math.round(point.x / step) * step,
      y: Math.round(point.y / step) * step,
    },
    width,
    height,
  );
}
/** Complete result or throw; callers only commit the complete result. */
export function planLayout(
  snapshot: Snapshot,
  input: LayoutOptions,
  aisleId: string,
) {
  const options = layoutOptionsSchema.parse(input);
  const { venue, tables } = layoutOf(snapshot);
  const areas = [...venue.areas];
  const hasAisle = areas.some((a) => a.kind === "aisle");
  const automaticAisle =
    options.centralAisle && !hasAisle
      ? {
          id: aisleId,
          kind: "aisle" as const,
          label: "中央过道",
          x: Math.round((venue.width - options.aisleWidth) / 2),
          y: 0,
          width: options.aisleWidth,
          height: venue.height,
        }
      : null;
  if (automaticAisle) areas.push(automaticAisle);
  const aisle =
    automaticAisle ??
    areas.find(
      (a) => a.kind === "aisle" && a.y === 0 && a.height === venue.height,
    );
  const margin = TABLE_RADIUS + AREA_CLEARANCE;
  const stepX = TABLE_RADIUS * 2 + options.columnGap;
  function segment(left: number, right: number, count: number) {
    if (!count) return [];
    if (right - left < (count - 1) * stepX)
      throw new Error(
        "每行桌数或间距过大，请减少桌数/间距或扩大画布；未改变布局",
      );
    const start = (left + right - (count - 1) * stepX) / 2;
    return Array.from({ length: count }, (_, i) =>
      Math.round(start + i * stepX),
    );
  }
  const xs = aisle
    ? [
        ...segment(margin, aisle.x - margin, Math.floor(options.columns / 2)),
        ...segment(
          aisle.x + aisle.width + margin,
          venue.width - margin,
          Math.ceil(options.columns / 2),
        ),
      ]
    : segment(margin, venue.width - margin, options.columns);
  const locked = tables.filter((t) => t.locked);
  if (
    locked.some((t) =>
      areas.some(
        (a) =>
          a.kind === "aisle" && intersectsArea(t.position, a, AREA_CLEARANCE),
      ),
    )
  )
    throw new Error("锁定桌位于过道或过道缓冲区，请先解锁并移出；未改变布局");
  const placed = locked.map((t) => t.position);
  const slots: Point[] = [];
  for (
    let y = 160;
    y <= venue.height - margin;
    y += TABLE_RADIUS * 2 + options.rowGap
  )
    for (const x of xs) slots.push({ x, y });
  let index = 0;
  const arranged = tables.map((table) => {
    if (table.locked) return table;
    let point: Point | undefined;
    while (index < slots.length) {
      const candidate = slots[index++];
      if (
        available(
          candidate,
          placed,
          areas,
          Math.min(options.columnGap, options.rowGap),
        )
      ) {
        point = candidate;
        break;
      }
    }
    if (!point)
      throw new Error(
        "画布空间不足或禁放区域占用，请扩大画布、减少间距或调整每行桌数；未改变布局",
      );
    placed.push(point);
    return { ...table, position: point };
  });
  return {
    ...snapshot,
    event: { ...snapshot.event, venue: { ...venue, areas } },
    tables: arranged,
  };
}
export function findNewTablePosition(snapshot: Snapshot) {
  const { venue, tables } = layoutOf(snapshot);
  const placed = tables.map((t) => t.position);
  const columns = Math.max(1, Math.floor((venue.width - 100) / 150));
  const limit = columns * Math.max(1, Math.ceil(venue.height / 150));
  for (let i = 0; i < limit; i++) {
    const point = defaultPosition(i, venue.width);
    if (point.y + TABLE_RADIUS + AREA_CLEARANCE > venue.height) break;
    if (
      point.x < TABLE_RADIUS + AREA_CLEARANCE ||
      point.x + TABLE_RADIUS + AREA_CLEARANCE > venue.width
    )
      continue;
    if (available(point, placed, venue.areas)) return point;
  }
  throw new Error("没有可用的网格空位，请扩大画布或调整布局后重试；未新增桌位");
}
