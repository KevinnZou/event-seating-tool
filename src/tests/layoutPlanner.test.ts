import { expect, it } from "vitest";
import { fixture } from "./fixtures/snapshot";
import {
  planLayout,
  defaultLayoutOptions,
  intersectsArea,
  snapPoint,
  findNewTablePosition,
  AREA_CLEARANCE,
} from "../domain/layoutPlanner";
import { calculateEventStats } from "../domain/calculations";
import { layoutOf } from "../domain/geometry";
import { SeatingDB } from "../db/database";
import { Repository } from "../db/repository";
import { VenueService } from "../domain/venueService";
import { SeatingService } from "../domain/services";
import { BackupService } from "../features/export/backupService";
import { parseBackup, remapBackup } from "../features/export/backup";
import { fingerprint } from "../domain/snapshots";
it("中央过道分两侧网格，对齐间距且不改变人数/宾客，纯函数不改输入", () => {
  const s = fixture(),
    original = structuredClone(s);
  s.tables = Array.from({ length: 12 }, (_, i) => ({
    ...s.tables[0],
    id: crypto.randomUUID(),
    label: String(i + 1),
  }));
  s.guests = [];
  const before = structuredClone(s);
  const planned = planLayout(s, defaultLayoutOptions, crypto.randomUUID());
  const { venue, tables } = layoutOf(planned),
    aisle = venue.areas[0];
  expect(aisle.kind).toBe("aisle");
  expect(
    tables.every((t) => !intersectsArea(t.position, aisle, AREA_CLEARANCE)),
  ).toBe(true);
  expect(new Set(tables.map((t) => t.position.y)).size).toBe(3);
  expect(new Set(tables.slice(0, 4).map((t) => t.position.y)).size).toBe(1);
  expect(tables[1].position.x - tables[0].position.x).toBe(150);
  expect(tables[4].position.y - tables[0].position.y).toBe(150);
  expect(calculateEventStats(planned)).toEqual(calculateEventStats(s));
  expect(s).toEqual(before);
  expect(original.guests[0].size).toBe(4);
});
it("自定义过道/舞台避让，既有过道不重复创建或删除，锁定桌原位保留", () => {
  const s = fixture();
  const aisle = {
    id: crypto.randomUUID(),
    kind: "aisle" as const,
    label: "虚构横向过道",
    x: 0,
    y: 230,
    width: 1200,
    height: 100,
  };
  s.event.venue = { width: 1200, height: 900, areas: [aisle] };
  s.tables[0].locked = true;
  s.tables[0].position = { x: 100, y: 140 };
  const result = planLayout(s, defaultLayoutOptions, crypto.randomUUID());
  expect(result.event.venue!.areas).toEqual([aisle]);
  expect(result.tables[0].position).toEqual(s.tables[0].position);
  expect(
    layoutOf(result).tables.every(
      (t) => !intersectsArea(t.position, aisle, 24),
    ),
  ).toBe(true);
  s.tables[0].position = { x: 100, y: 260 };
  expect(() =>
    planLayout(s, defaultLayoutOptions, crypto.randomUUID()),
  ).toThrow("锁定桌");
});
it("无解/非法规则不产生部分结果，吸附含边界与非法输入，新桌优先找非过道空位", () => {
  const s = fixture();
  s.event.venue = { width: 400, height: 400, areas: [] };
  expect(() =>
    planLayout(s, defaultLayoutOptions, crypto.randomUUID()),
  ).toThrow();
  expect(() =>
    planLayout(s, { ...defaultLayoutOptions, columns: 0 }, crypto.randomUUID()),
  ).toThrow();
  expect(snapPoint({ x: 113, y: 169 }, 1200, 800, 20)).toEqual({
    x: 120,
    y: 160,
  });
  expect(snapPoint({ x: -10, y: 900 }, 400, 400, 20)).toEqual({
    x: 48,
    y: 352,
  });
  expect(() => snapPoint({ x: 1, y: 2 }, 400, 400, 0)).toThrow();
  const arranged = planLayout(
    fixture(),
    defaultLayoutOptions,
    crypto.randomUUID(),
  );
  const p = findNewTablePosition(arranged);
  expect(
    arranged.event.venue!.areas.some((a) => intersectsArea(p, a, 24)),
  ).toBe(false);
  expect(
    layoutOf(arranged).tables.every(
      (t) => Math.hypot(t.position.x - p.x, t.position.y - p.y) >= 120,
    ),
  ).toBe(true);
});
it("服务整理/新增保护过道、失败全量回滚、旧预览拒绝、过道备份恢复完整保留", async () => {
  const db = new SeatingDB(crypto.randomUUID()),
    repo = new Repository(db);
  const s = fixture(),
    id = s.event.id;
  try {
    await repo.transaction(async () => {
      await db.events.add(s.event);
      await db.guests.bulkAdd(s.guests);
      await db.seatingTables.bulkAdd(s.tables);
    });
    const service = new VenueService(repo),
      crud = new SeatingService(repo);
    await service.arrange(id, defaultLayoutOptions, fingerprint(s));
    const before = await repo.snapshot(id);
    const aisle = before.event.venue!.areas.find((a) => a.kind === "aisle")!;
    await expect(
      service.position(id, "table", before.tables[0].id, { x: 600, y: 400 }),
    ).rejects.toThrow("过道");
    await expect(
      service.arrange(id, defaultLayoutOptions, fingerprint(s)),
    ).rejects.toThrow("预览后数据");
    await expect(
      service.arrange(id, { ...defaultLayoutOptions, columns: 30 }),
    ).rejects.toThrow();
    expect(await repo.snapshot(id)).toEqual(before);
    await crud.saveTable(id, {
      label: "新虚构桌",
      capacity: 10,
      locked: false,
    });
    const after = await repo.snapshot(id),
      table = after.tables.find((t) => t.label === "新虚构桌")!;
    expect(intersectsArea(table.position!, aisle, 24)).toBe(false);
    expect(after.tables.slice(0, before.tables.length)).toEqual(before.tables);
    expect(after.guests).toEqual(before.guests);
    const bundle = await new BackupService(repo).export(id);
    const parsed = parseBackup(JSON.parse(JSON.stringify(bundle)));
    const restored = remapBackup(parsed);
    expect(restored.events[0].venue!.areas[0].kind).toBe("aisle");
    await service.saveArea(id, {
      kind: "zone",
      label: "全场禁放测试",
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    });
    const full = await repo.snapshot(id);
    await expect(
      crud.saveTable(id, { label: "不能放下", capacity: 10, locked: false }),
    ).rejects.toThrow("没有可用");
    expect(await repo.snapshot(id)).toEqual(full);
  } finally {
    await db.delete();
  }
});

it("Dexie3升级4保留已排位置和名单，不重新排桌", async () => {
  const { default: Dexie } = await import("dexie");
  const name = crypto.randomUUID(),
    old = new Dexie(name),
    s = fixture();
  old.version(3).stores({
    events: "id, updatedAt",
    guests: "id, eventId, tableId, [eventId+tableId]",
    seatingTables: "id, eventId, [eventId+orderIndex]",
    checkpoints: "id, eventId, createdAt",
    localMeta: "key",
  });
  s.event.venue = { width: 1200, height: 800, areas: [] };
  s.tables[0].position = { x: 180, y: 280 };
  await old.open();
  await old.table("events").add(s.event);
  await old.table("guests").bulkAdd(s.guests);
  await old.table("seatingTables").bulkAdd(s.tables);
  old.close();
  const current = new SeatingDB(name);
  try {
    expect(await new Repository(current).snapshot(s.event.id)).toEqual(s);
    expect(current.verno).toBe(4);
  } finally {
    await current.delete();
  }
});
