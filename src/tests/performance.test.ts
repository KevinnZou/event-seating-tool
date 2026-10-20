import { it, expect } from "vitest";
import { fixture } from "./fixtures/snapshot";
import { parseText } from "../features/import/parsers";
import { planImport } from "../features/import/importService";
import { calculateEventStats } from "../domain/calculations";
import { filterGuests, initialFilters } from "../features/seating/selectors";
function performanceText(people: number) {
  return Array.from(
    { length: people / 10 },
    (_, t) =>
      `${String(t + 1).padStart(2, "0")}号桌：${Array.from({ length: t === 0 ? 7 : 10 }, (_, i) => `虚构性能${t + 1}桌${i + 1}组${t === 0 && i === 0 ? "一家(4)" : ""}`).join("、")}`,
  ).join("\n");
}
it.each([300, 500])("%s人数据完整规划与搜索在合理预算内", (people) => {
  const seed = fixture(),
    s = { ...seed, tables: [], guests: [] };
  const start = performance.now();
  const planned = planImport(
    s,
    parseText(performanceText(people)),
    "append",
    true,
  );
  expect(calculateEventStats(planned)).toMatchObject({
    plannedCount: people,
    assignedCount: people,
    tableCount: people / 10,
  });
  expect(
    filterGuests(planned, { ...initialFilters, query: "yijia" }),
  ).toHaveLength(1);
  expect(performance.now() - start).toBeLessThan(3000);
});

it("支持1000个独立组、5000人，不因同名或最大桌号改变数量", () => {
  const seed = fixture();
  const text = Array.from(
    { length: 100 },
    (_, table) =>
      `${String(table + 1).padStart(2, "0")}号桌：${Array.from({ length: 10 }, (_, group) => `虚构大型同名${group % 5}(5)`).join("、")}`,
  ).join("\n");
  const planned = planImport(
    {
      ...seed,
      event: { ...seed.event, defaultCapacity: 50 },
      tables: [],
      guests: [],
    },
    parseText(text),
    "append",
    true,
  );
  expect(planned.guests).toHaveLength(1000);
  expect(new Set(planned.guests.map((guest) => guest.id)).size).toBe(1000);
  expect(calculateEventStats(planned)).toMatchObject({
    totalRecordedCount: 5000,
    plannedCount: 5000,
    assignedCount: 5000,
    tableCount: 100,
  });
});
