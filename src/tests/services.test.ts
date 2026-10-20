import { beforeEach, afterEach, it, expect } from "vitest";
import { SeatingDB } from "../db/database";
import { Repository } from "../db/repository";
import { SeatingService } from "../domain/services";
import { calculateEventStats } from "../domain/calculations";
import { demoGuests } from "./fixtures/demo";
let db: SeatingDB;
let repo: Repository;
let service: SeatingService;
let a: string;
let b: string;
beforeEach(async () => {
  db = new SeatingDB(`test-${crypto.randomUUID()}`);
  repo = new Repository(db);
  service = new SeatingService(repo);
  a = await service.createEvent({
    name: "虚构A",
    type: "wedding",
    defaultCapacity: 10,
  });
  b = await service.createEvent({
    name: "虚构B",
    type: "annual-party",
    defaultCapacity: 15,
  });
  for (const label of ["01", "03", "66"])
    await service.saveTable(a, { label, capacity: 10, locked: false });
  for (const g of demoGuests) await service.saveGuest(a, g);
});
afterEach(async () => {
  await db.delete();
});
it("两活动隔离，跨活动移动与更新被拒绝", async () => {
  await service.saveTable(b, { label: "01", capacity: 15, locked: false });
  const sa = await repo.snapshot(a),
    sb = await repo.snapshot(b);
  expect(sb.guests).toHaveLength(0);
  await expect(
    service.moveGuestGroup(a, sa.guests[0].id, sb.tables[0].id),
  ).rejects.toThrow("当前活动");
  await expect(
    service.saveGuest(b, demoGuests[0], sa.guests[0].id),
  ).rejects.toThrow();
  expect((await repo.snapshot(a)).guests).toHaveLength(6);
});
it("移动家庭4人总人数守恒，超员失败不改变数据库", async () => {
  const s = await repo.snapshot(a);
  const g = s.guests[0];
  await service.moveGuestGroup(a, g.id, s.tables[0].id);
  expect(calculateEventStats(await repo.snapshot(a)).assignedCount).toBe(4);
  await service.moveGuestGroup(a, g.id, s.tables[1].id);
  const before = await repo.snapshot(a);
  await expect(
    service.saveGuest(a, { ...demoGuests[0], size: 11 }, g.id),
  ).rejects.toThrow("超出");
  expect(await repo.snapshot(a)).toEqual(before);
  expect(calculateEventStats(before).plannedCount).toBe(11);
});
it("桌号唯一性按活动检查；重命名不改变桌ID", async () => {
  const s = await repo.snapshot(a);
  await expect(
    service.saveTable(a, { label: "1", capacity: 10, locked: false }),
  ).rejects.toThrow("桌号重复");
  await service.saveTable(a, { ...s.tables[0], label: "主桌" }, s.tables[0].id);
  expect((await repo.snapshot(a)).tables[0].id).toBe(s.tables[0].id);
});
it("删桌迁回未安排且不减人数", async () => {
  const s = await repo.snapshot(a);
  await service.moveGuestGroup(a, s.guests[0].id, s.tables[0].id);
  await service.deleteTable(a, s.tables[0].id);
  const after = await repo.snapshot(a);
  expect(after.guests[0].tableId).toBeNull();
  expect(calculateEventStats(after).totalRecordedCount).toBe(12);
});
it("不参加需确认撤回桌位且保留记录", async () => {
  const s = await repo.snapshot(a);
  await service.moveGuestGroup(a, s.guests[0].id, s.tables[0].id);
  await expect(
    service.setAttendance(a, s.guests[0].id, "declined"),
  ).rejects.toThrow("确认");
  await service.setAttendance(a, s.guests[0].id, "declined", true);
  const after = await repo.snapshot(a);
  expect(after.guests[0].tableId).toBeNull();
  expect(calculateEventStats(after)).toMatchObject({
    totalRecordedCount: 12,
    plannedCount: 7,
    assignedCount: 0,
    declinedCount: 5,
  });
});
it("锁定桌阻止编辑、移动与删除，解锁后可操作", async () => {
  const s = await repo.snapshot(a);
  await service.saveTable(a, { ...s.tables[0], locked: true }, s.tables[0].id);
  await expect(
    service.moveGuestGroup(a, s.guests[0].id, s.tables[0].id),
  ).rejects.toThrow("解锁");
  await expect(service.deleteTable(a, s.tables[0].id)).rejects.toThrow("解锁");
  await expect(
    service.saveTable(
      a,
      { ...s.tables[0], label: "新桌", locked: false },
      s.tables[0].id,
    ),
  ).rejects.toThrow("解锁");
  await service.saveTable(a, { ...s.tables[0], locked: false }, s.tables[0].id);
  await service.moveGuestGroup(a, s.guests[0].id, s.tables[0].id);
});
it("复制活动重建全部ID与桌引用，同名不合并", async () => {
  const s = await repo.snapshot(a);
  await service.moveGuestGroup(a, s.guests[0].id, s.tables[0].id);
  const copy = await service.copyEvent(a);
  const copied = await repo.snapshot(copy);
  expect(copied.guests).toHaveLength(6);
  expect(
    copied.guests.filter((g) => g.displayName === "示例云朵"),
  ).toHaveLength(2);
  expect(copied.guests[0].id).not.toBe(s.guests[0].id);
  expect(copied.guests[0].tableId).toBe(copied.tables[0].id);
  expect(calculateEventStats(copied)).toEqual(
    calculateEventStats(await repo.snapshot(a)),
  );
});
it("删除活动只删除本活动且要求准确名称", async () => {
  await expect(service.deleteEvent(a, "错名")).rejects.toThrow();
  await service.deleteEvent(a, "虚构A");
  expect(await db.events.get(a)).toBeUndefined();
  expect((await repo.snapshot(b)).event.name).toBe("虚构B");
  expect(await db.guests.where("eventId").equals(a).count()).toBe(0);
});
it("事务中途失败完整回滚", async () => {
  const before = await repo.snapshot(a);
  await expect(
    repo.transaction(async () => {
      await service.saveGuest(a, {
        ...demoGuests[0],
        displayName: "虚构临时记录",
      });
      throw new Error("模拟失败");
    }),
  ).rejects.toThrow("模拟失败");
  expect(await repo.snapshot(a)).toEqual(before);
});
it("关闭数据库重新打开仍保存，非localStorage", async () => {
  db.close();
  await db.open();
  expect((await repo.snapshot(a)).guests).toHaveLength(6);
});
it("删除宾客只减少明确删除人数；编辑活动持久保存", async () => {
  const s = await repo.snapshot(a);
  await service.deleteGuest(a, s.guests[0].id);
  expect(calculateEventStats(await repo.snapshot(a)).totalRecordedCount).toBe(
    8,
  );
  await service.updateEvent(a, {
    name: "虚构已编辑",
    type: "banquet",
    defaultCapacity: 15,
  });
  expect((await repo.snapshot(a)).event.name).toBe("虚构已编辑");
});

it("并发移入同一桌仍按事务校验容量", async () => {
  await service.saveGuest(a, {
    ...demoGuests[0],
    displayName: "虚构并发甲",
    size: 6,
  });
  await service.saveGuest(a, {
    ...demoGuests[0],
    displayName: "虚构并发乙",
    size: 6,
  });
  const s = await repo.snapshot(a);
  const groups = s.guests.filter((g) => g.size === 6);
  const results = await Promise.allSettled(
    groups.map((g) => service.moveGuestGroup(a, g.id, s.tables[0].id)),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(calculateEventStats(await repo.snapshot(a)).assignedCount).toBe(6);
});
it("无效输入不写库，复制完整性错误时不静默丢失引用", async () => {
  const before = await repo.snapshot(a);
  await expect(
    service.saveGuest(a, { ...demoGuests[0], size: 0 }),
  ).rejects.toThrow();
  expect(await repo.snapshot(a)).toEqual(before);
  await db.guests.update(before.guests[0].id, { tableId: crypto.randomUUID() });
  await expect(service.copyEvent(a)).rejects.toThrow("完整性");
  expect(await db.events.count()).toBe(2);
});

it("schema1升级schema2保留已有活动、桌位和宾客", async () => {
  const { default: Dexie } = await import("dexie");
  const legacyName = `legacy-${crypto.randomUUID()}`,
    legacy = new Dexie(legacyName);
  legacy
    .version(1)
    .stores({
      events: "id, updatedAt",
      guests: "id, eventId, tableId, [eventId+tableId]",
      seatingTables: "id, eventId, [eventId+orderIndex]",
      checkpoints: "id, eventId, createdAt",
    });
  const s = await repo.snapshot(a);
  await legacy.table("events").add(s.event);
  await legacy.table("guests").bulkAdd(s.guests);
  await legacy.table("seatingTables").bulkAdd(s.tables);
  legacy.close();
  const upgraded = new SeatingDB(legacyName);
  try {
    const restored = await new Repository(upgraded).snapshot(a);
    expect(restored).toEqual(s);
    await upgraded.localMeta.put({ key: "test", value: "ok" });
    expect(await upgraded.localMeta.get("test")).toEqual({
      key: "test",
      value: "ok",
    });
  } finally {
    await upgraded.delete();
  }
});
