import { DndContext } from "@dnd-kit/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { fixture } from "../../tests/fixtures/snapshot";
import { RoundTable } from "./RoundTable";

afterEach(cleanup);
it("满名单完整呈现末组、长姓名和同名独立记录，展示不修改源数据", () => {
  const snapshot = fixture();
  const table = {
    ...snapshot.tables[0],
    capacity: 30,
    position: { x: 100, y: 160 },
  };
  snapshot.tables[0] = table;
  snapshot.guests = Array.from({ length: 26 }, (_, index) => ({
    ...snapshot.guests[0],
    id: crypto.randomUUID(),
    tableId: table.id,
    displayName:
      index < 2 ? "虚构同名来宾" : `虚构长名称家庭及同行亲友第${index + 1}组`,
    size: 1,
  }));
  const before = JSON.stringify(snapshot);
  render(
    <DndContext>
      <RoundTable
        table={table}
        snapshot={snapshot}
        position={table.position}
        showRoster
        selected={false}
        layoutMode={false}
        busy={false}
        onSelect={vi.fn()}
        onPointerDown={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerUp={vi.fn()}
        onCancel={vi.fn()}
        onNudge={vi.fn()}
      />
    </DndContext>,
  );
  const roster = within(screen.getByRole("region", { name: "01桌宾客名单" }));
  expect(roster.getAllByRole("listitem")).toHaveLength(26);
  expect(roster.getAllByText("虚构同名来宾")).toHaveLength(2);
  expect(
    roster.getByText("虚构长名称家庭及同行亲友第26组"),
  ).toBeInTheDocument();
  expect(JSON.stringify(snapshot)).toBe(before);
});
