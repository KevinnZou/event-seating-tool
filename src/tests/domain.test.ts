import { describe, it, expect } from "vitest";
import {
  nextOrderIndex,
  assertCapacity,
  calculateEventStats,
  normalizeTableLabel,
  validateEvent,
} from "../domain/calculations";
import { countSchema, type Snapshot } from "../domain/models";
import { demoGuests } from "./fixtures/demo";
const time = "2026-10-19T00:00:00.000Z";
export function fixture(): Snapshot {
  const eventId = crypto.randomUUID();
  const tables = ["01", "03", "66"].map((label, i) => ({
    id: crypto.randomUUID(),
    eventId,
    label,
    capacity: i === 0 ? 15 : 10,
    orderIndex: i,
    locked: false,
    createdAt: time,
    updatedAt: time,
  }));
  return {
    event: {
      id: eventId,
      name: "虚构测试婚宴",
      type: "wedding",
      defaultCapacity: 10,
      overCapacityPolicy: "block",
      schemaVersion: 1,
      createdAt: time,
      updatedAt: time,
    },
    tables,
    guests: demoGuests.map((g, i) => ({
      ...g,
      id: crypto.randomUUID(),
      eventId,
      tableId: i === 0 ? tables[1].id : null,
      orderIndex: i,
      createdAt: time,
      updatedAt: time,
    })),
  };
}
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
