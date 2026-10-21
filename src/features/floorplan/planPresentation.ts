import type { Point } from "../../domain/venueModels";
// Display-only expansion keeps readable rosters apart without changing venue geometry.
export const ROSTER_COORDINATE_SCALE = 2.6;
export function planDragPoint(
  origin: Point,
  start: Point,
  current: Point,
  zoom: number,
  coordinateScale: number,
): Point {
  if (
    !Number.isFinite(zoom) ||
    zoom <= 0 ||
    !Number.isFinite(coordinateScale) ||
    coordinateScale <= 0
  )
    throw new Error("画布缩放必须为正数");
  return {
    x: origin.x + (current.x - start.x) / zoom / coordinateScale,
    y: origin.y + (current.y - start.y) / zoom / coordinateScale,
  };
}
