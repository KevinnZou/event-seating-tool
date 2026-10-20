import { splitSizes } from "../domain/snapshots";
import { describe, it, expect } from "vitest";
import {
  nextOrderIndex,
  tableParity,
  assertCapacity,
  calculateEventStats,
  normalizeTableLabel,
  validateEvent,
} from "../domain/calculations";
import { countSchema } from "../domain/models";
import { fixture } from "./fixtures/snapshot";
describe("统计与不变量", () => {
  it("家庭4人、同名2条、出席口径、跳号桌数", () => {
    const s = fixture();
    expect(calculateEventStats(s)).toMatchObject({
      totalRecordedCount: 12,
      plannedCount: 11,
      confirmedCount: 10,
      tentativeCount: 1,
      declinedCount: 1,
      assignedCount: 4,
      unassignedCount: 7,
      tableCount: 3,
      groupCount: 6,
      capacity: 35,
      freeSeats: 31,
    });
    expect(
      validateEvent(s).filter((i) => i.code === "duplicate-name"),
    ).toHaveLength(1);
  });
  it.each(["0", "00", "000"])("桌号 %s 规范化为0", (value) =>
    expect(normalizeTableLabel(value)).toBe("0"),
  );
  it("数字桌号去前导零，文字保留", () => {
    expect(normalizeTableLabel(" 01 ")).toBe("1");
    expect(normalizeTableLabel("A01")).toBe("A01");
  });
  it.each([0, -1, 1.5, 1000, NaN, Infinity])("拒绝非法数值 %s", (value) =>
    expect(countSchema.safeParse(value).success).toBe(false),
  );
  it("支持1与999边界", () => {
    expect(countSchema.parse(1)).toBe(1);
    expect(countSchema.parse(999)).toBe(999);
  });
  it("不把非法桌引用算作已安排", () => {
    const s = fixture();
    s.guests[0].tableId = crypto.randomUUID();
    expect(calculateEventStats(s).assignedCount).toBe(0);
    expect(validateEvent(s).some((i) => i.code === "invalid-reference")).toBe(
      true,
    );
  });
  it("容量检查阻止超员、拒绝不参加，原桌移动不重复计数", () => {
    const s = fixture();
    expect(() =>
      assertCapacity(s, s.guests[0].id, s.tables[1].id, 4, "confirmed"),
    ).not.toThrow();
    expect(() =>
      assertCapacity(s, "new", s.tables[1].id, 7, "confirmed"),
    ).toThrow("超出 1 席");
    expect(() =>
      assertCapacity(s, "new", s.tables[1].id, 1, "declined"),
    ).toThrow("不参加");
  });
  it("纯函数暴露重复桌号、ID、非法人数和超员", () => {
    const s = fixture();
    s.tables[0].label = "3";
    s.tables[1].capacity = 3;
    s.guests.push({ ...s.guests[0] });
    s.guests[2].size = 0;
    const codes = validateEvent(s).map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "duplicate-label",
        "duplicate-id",
        "invalid-guest",
        "over-capacity",
      ]),
    );
  });
  it("不同活动混入的记录不参与统计", () => {
    const s = fixture();
    s.guests.push({
      ...s.guests[0],
      id: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      size: 900,
    });
    expect(calculateEventStats(s).plannedCount).toBe(11);
  });
});

it("删除后新增序号仍追加且不重排", () => {
  expect(nextOrderIndex([])).toBe(0);
  expect(nextOrderIndex([{ orderIndex: 0 }, { orderIndex: 5 }])).toBe(6);
});

it("奇偶判断不受超长数字桌号精度影响", () => {
  expect(tableParity("01")).toBe("odd");
  expect(tableParity("66")).toBe("even");
  expect(tableParity("A1")).toBe("custom");
  expect(tableParity("1234567890123456789012345678901234567891")).toBe("odd");
});

describe("拆分份额纯函数", () => {
  it.each([
    { total: 4, sizes: [1, 1, 2], expected: true },
    { total: 4, sizes: [1, 1, 1, 1], expected: true },
    { total: 4, sizes: [4], expected: false },
    { total: 4, sizes: [0, 4], expected: false },
    { total: 4, sizes: [-1, 5], expected: false },
    { total: 4, sizes: [1.5, 2.5], expected: false },
    { total: 4, sizes: [1, 2], expected: false },
    { total: 4, sizes: [2, 3], expected: false },
    { total: 4, sizes: [NaN, 4], expected: false },
    { total: 4, sizes: [Infinity, 1], expected: false },
  ])("$total 人拆为 $sizes → $expected", ({ total, sizes, expected }) => {
    expect(splitSizes(total, sizes)).toBe(expected);
  });
});
