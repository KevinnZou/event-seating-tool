import { describe, expect, it } from "vitest";
import { planDragPoint, ROSTER_COORDINATE_SCALE } from "./planPresentation";

describe("场地图显示坐标与真实坐标转换", () => {
  it.each([1, 0.8, 0.3, 2.4])("缩放%f时名单视图拖动仍写入真实距离", (zoom) => {
    const origin = { x: 200, y: 300 };
    const start = { x: 70, y: 80 };
    const current = {
      x: 70 + 40 * zoom * ROSTER_COORDINATE_SCALE,
      y: 80 - 20 * zoom * ROSTER_COORDINATE_SCALE,
    };
    const result = planDragPoint(
      origin,
      start,
      current,
      zoom,
      ROSTER_COORDINATE_SCALE,
    );
    expect(result.x).toBeCloseTo(240);
    expect(result.y).toBeCloseTo(280);
    expect(origin).toEqual({ x: 200, y: 300 });
  });
  it("简洁视图保留原拖动距离，点选没有位移", () => {
    expect(
      planDragPoint(
        { x: 100, y: 200 },
        { x: 10, y: 10 },
        { x: 30, y: 0 },
        0.5,
        1,
      ),
    ).toEqual({ x: 140, y: 180 });
    expect(
      planDragPoint(
        { x: 100, y: 200 },
        { x: 10, y: 10 },
        { x: 10, y: 10 },
        0.8,
        ROSTER_COORDINATE_SCALE,
      ),
    ).toEqual({ x: 100, y: 200 });
  });
  it.each([0, -1, NaN, Infinity])(
    "拒绝无效缩放%f，避免非有限坐标写入",
    (invalid) => {
      const origin = { x: 100, y: 200 };
      expect(() => planDragPoint(origin, origin, origin, invalid, 1)).toThrow();
      expect(() => planDragPoint(origin, origin, origin, 1, invalid)).toThrow();
    },
  );
});
