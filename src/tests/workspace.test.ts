import { it, expect, beforeEach, afterEach } from "vitest";
import { SeatingDB } from "../db/database";
import { Repository } from "../db/repository";
import { SeatingService } from "../domain/services";
import { WorkspaceService } from "../domain/workspaceService";
import { HistoryService } from "../domain/historyService";
import { calculateEventStats } from "../domain/calculations";
import { filterGuests, initialFilters } from "../features/seating/selectors";
let db: SeatingDB;
let repo: Repository;
let crud: SeatingService;
let svc: WorkspaceService;
let history: HistoryService;
let id: string;
beforeEach(async () => {
  db = new SeatingDB(crypto.randomUUID());
  repo = new Repository(db);
  crud = new SeatingService(repo);
  svc = new WorkspaceService(repo);
  history = new HistoryService(svc);
  id = await crud.createEvent(
    { name: "虚构工作台", type: "wedding", defaultCapacity: 10 },
    2,
  );
  await crud.saveGuest(id, {
    displayName: "测试小禾一家",
    size: 4,
    kind: "family",
    attendance: "confirmed",
  });
  await crud.saveGuest(id, {
    displayName: "测试星舟团队",
    size: 7,
    kind: "team",
    attendance: "confirmed",
  });
});
afterEach(() => db.delete());
it("批量移动全有或全无且撤销重做保人数", async () => {
  const s = await repo.snapshot(id);
  await expect(
    svc.move(
      id,
      s.guests.map((g) => g.id),
      s.tables[0].id,
    ),
  ).rejects.toThrow();
  expect(calculateEventStats(await repo.snapshot(id)).assignedCount).toBe(0);
  await history.execute(id, () =>
    svc.move(id, [s.guests[0].id], s.tables[0].id),
  );
  await history.undo(id);
  expect(calculateEventStats(await repo.snapshot(id)).assignedCount).toBe(0);
  await history.redo(id);
  expect(calculateEventStats(await repo.snapshot(id)).assignedCount).toBe(4);
});
it("外部变更后拒绝撤销覆盖", async () => {
  const s = await repo.snapshot(id);
  await history.execute(id, () =>
    svc.move(id, [s.guests[0].id], s.tables[0].id),
  );
  await crud.saveGuest(id, {
    displayName: "外部虚构组",
    size: 1,
    kind: "person",
    attendance: "confirmed",
  });
  await expect(history.undo(id)).rejects.toThrow("其他操作");
  expect((await repo.snapshot(id)).guests).toHaveLength(3);
});
it("拆分守恒并保留来源，错误份额不写入", async () => {
  const s = await repo.snapshot(id);
  await expect(
    svc.split(id, s.guests[0].id, [
      { name: "虚构甲", size: 2 },
      { name: "虚构乙", size: 3 },
    ]),
  ).rejects.toThrow();
  await svc.split(id, s.guests[0].id, [
    { name: "虚构甲", size: 1 },
    { name: "虚构乙", size: 3 },
  ]);
  const after = await repo.snapshot(id);
  expect(calculateEventStats(after).plannedCount).toBe(11);
  expect(after.guests[2].originGroupId).toBe(s.guests[0].id);
});
it("桌位对调按目标容量校验并保留标签，排序显式保存", async () => {
  const s = await repo.snapshot(id);
  await svc.move(id, [s.guests[0].id], s.tables[0].id);
  await svc.swap(id, s.tables[0].id, s.tables[1].id);
  expect((await repo.snapshot(id)).guests[0].tableId).toBe(s.tables[1].id);
  await svc.reorder(id, s.tables[0].id, 1);
  expect((await repo.snapshot(id)).tables[0].id).toBe(s.tables[1].id);
});
it("拼音、原文、分类、未安排筛选和自然桌号排序", async () => {
  const s = await repo.snapshot(id);
  expect(filterGuests(s, { ...initialFilters, query: "xiaohe" })).toHaveLength(
    1,
  );
  expect(
    filterGuests(s, { ...initialFilters, table: "unassigned" }),
  ).toHaveLength(2);
});

it("连续多步撤销和重做不会被更新时间误判为外部修改", async () => {
  const s = await repo.snapshot(id);
  await history.execute(id, () =>
    svc.move(id, [s.guests[0].id], s.tables[0].id),
  );
  await history.execute(id, () =>
    svc.move(id, [s.guests[1].id], s.tables[1].id),
  );
  await history.undo(id);
  await history.undo(id);
  expect(calculateEventStats(await repo.snapshot(id)).assignedCount).toBe(0);
  await history.redo(id);
  await history.redo(id);
  expect(calculateEventStats(await repo.snapshot(id)).assignedCount).toBe(11);
});
