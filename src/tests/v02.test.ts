import { it, expect, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import { SeatingDB } from "../db/database";
import { Repository } from "../db/repository";
import { SeatingService } from "../domain/services";
import { VenueService } from "../domain/venueService";
import { VersionService, compareSnapshots } from "../domain/versions";
import {
  suggestSeating,
  applyProposal,
  SuggestionService,
} from "../domain/suggestions";
import { layoutOf, clampPoint, layoutWarnings } from "../domain/geometry";
import { fingerprint, parseSnapshot } from "../domain/snapshots";
import { calculateEventStats } from "../domain/calculations";
import { BackupService } from "../features/export/backupService";
import { decodeBackup } from "../features/export/backup";
import { fixture } from "./fixtures/snapshot";
let db: SeatingDB,
  repo: Repository,
  crud: SeatingService,
  venue: VenueService,
  versions: VersionService,
  id: string;
beforeEach(async () => {
  db = new SeatingDB(crypto.randomUUID());
  repo = new Repository(db);
  crud = new SeatingService(repo);
  venue = new VenueService(repo);
  versions = new VersionService(repo);
  const s = fixture();
  id = s.event.id;
  await repo.transaction(async () => {
    await db.events.add(s.event);
    await db.guests.bulkAdd(s.guests);
    await db.seatingTables.bulkAdd(s.tables);
  });
});
afterEach(() => db.delete());
it("画布坐标有限、整数、缩放边界截取，旧活动只计算默认布局不落库", async () => {
  expect(clampPoint({ x: -100, y: 9999 }, 1200, 800)).toEqual({
    x: 48,
    y: 752,
  });
  expect(clampPoint({ x: 99.8, y: 100.1 }, 1200, 800)).toEqual({
    x: 100,
    y: 100,
  });
  expect(() => clampPoint({ x: NaN, y: 1 }, 1200, 800)).toThrow();
  const s = await repo.snapshot(id);
  expect(layoutOf(s).tables[0].position).toEqual({ x: 100, y: 160 });
  expect((await repo.snapshot(id)).event.venue).toBeUndefined();
});
it("布局写入、区域增改删与锁定/越界/跨活动防护均不改变名单", async () => {
  const before = await repo.snapshot(id),
    table = before.tables[0];
  await venue.position(id, "table", table.id, { x: 400, y: 300 });
  expect(calculateEventStats(await repo.snapshot(id))).toEqual(
    calculateEventStats(before),
  );
  await venue.saveArea(id, {
    kind: "stage",
    label: "虚构舞台",
    x: 200,
    y: 40,
    width: 250,
    height: 80,
  });
  const area = (await repo.snapshot(id)).event.venue!.areas[0];
  await venue.position(id, "area", area.id, { x: 300, y: 50 });
  await venue.deleteArea(id, area.id);
  await crud.saveTable(id, { ...table, locked: true }, table.id);
  const locked = await repo.snapshot(id);
  await expect(
    venue.position(id, "table", table.id, { x: 100, y: 200 }),
  ).rejects.toThrow("解锁");
  await expect(
    venue.position(id, "table", crypto.randomUUID(), { x: 100, y: 200 }),
  ).rejects.toThrow("当前活动");
  await expect(venue.resize(id, 400, 400)).rejects.toThrow("边界");
  expect(await repo.snapshot(id)).toEqual(locked);
});
it("重叠有明确提示，自动整理不移动锁定桌，空间不足完整回滚", async () => {
  const s = await repo.snapshot(id);
  await venue.position(id, "table", s.tables[0].id, { x: 100, y: 160 });
  await venue.position(id, "table", s.tables[1].id, { x: 100, y: 160 });
  expect(layoutWarnings(await repo.snapshot(id))).toHaveLength(1);
  await crud.saveTable(id, { ...s.tables[0], locked: true }, s.tables[0].id);
  await venue.arrange(id);
  expect((await repo.snapshot(id)).tables[0].position).toEqual({
    x: 100,
    y: 160,
  });
  expect(layoutWarnings(await repo.snapshot(id))).toHaveLength(0);
  await venue.saveArea(id, {
    kind: "zone",
    label: "虚构占满场地",
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });
  const crowded = await repo.snapshot(id);
  await expect(venue.arrange(id)).rejects.toThrow("空间不足");
  expect(await repo.snapshot(id)).toEqual(crowded);
});
it("三种建议只动未排整组，锁定与不参加不触碰，人数守恒且确定性", async () => {
  const s = await repo.snapshot(id);
  s.tables[0].locked = true;
  for (const rule of ["compact", "category", "balanced"] as const) {
    const p = suggestSeating(s, { rule, includeTentative: true });
    expect(suggestSeating(s, { rule, includeTentative: true })).toEqual(p);
    expect(
      p.assignments.every(
        (a) =>
          a.tableId !== s.tables[0].id &&
          s.guests.find((g) => g.id === a.guestId)!.tableId === null,
      ),
    ).toBe(true);
    const after = applyProposal(s, p);
    expect(calculateEventStats(after).plannedCount).toBe(11);
    expect(after.guests[0]).toEqual(s.guests[0]);
    expect(
      after.guests.find((g) => g.attendance === "declined")!.tableId,
    ).toBeNull();
  }
});
it("建议容量不足逐组保留解释，不拆家庭；排除待定且拒绝并发/篡改", async () => {
  const s = await repo.snapshot(id);
  s.tables.forEach((t) => {
    t.locked = true;
  });
  const p = suggestSeating(s, { rule: "compact", includeTentative: false });
  expect(p.assignments).toHaveLength(0);
  expect(p.remaining).toHaveLength(4);
  expect(p.remaining.some((r) => r.reason.includes("待定"))).toBe(true);
  const changed = structuredClone(s);
  changed.guests[1].note = "虚构外部变更";
  expect(() => applyProposal(changed, p)).toThrow("变化");
  expect(() => applyProposal(s, { ...p, remaining: [] })).toThrow("不完整");
});
it("同类建议按显式分组解释，应用有检查点且跨活动拒绝", async () => {
  const s = await repo.snapshot(id);
  s.guests[0].category = "虚构A类";
  s.guests[1].category = "虚构A类";
  await db.guests.bulkPut(s.guests);
  const p = suggestSeating(s, { rule: "category", includeTentative: true });
  expect(p.assignments.find((a) => a.guestId === s.guests[1].id)?.tableId).toBe(
    s.tables[1].id,
  );
  expect(p.assignments.some((a) => a.reason.includes("同分组"))).toBe(true);
  await new SuggestionService(repo).apply(id, p);
  expect(await db.checkpoints.count()).toBe(1);
  await expect(new SuggestionService(repo).apply(id, p)).rejects.toThrow(
    "变化",
  );
});
it("命名版本与差异按ID区分同名、忽略更新时间，恢复先保护当前状态", async () => {
  const before = await repo.snapshot(id);
  const version = await versions.save(id, "虚构初稿");
  await venue.position(id, "table", before.tables[0].id, { x: 500, y: 400 });
  await crud.saveGuest(
    id,
    { ...before.guests[1], size: 3 },
    before.guests[1].id,
  );
  const after = await repo.snapshot(id);
  const changes = compareSnapshots(before, after);
  expect(changes.some((c) => c.kind === "人数")).toBe(true);
  expect(changes.some((c) => c.kind === "桌位置")).toBe(true);
  expect(
    compareSnapshots(before, {
      ...before,
      event: { ...before.event, updatedAt: new Date().toISOString() },
    }),
  ).toHaveLength(0);
  await versions.rename(id, version, "虚构确认稿");
  await versions.restore(id, version);
  expect((await repo.snapshot(id)).guests).toEqual(before.guests);
  expect(await db.checkpoints.count()).toBe(2);
  await expect(
    versions.rename(crypto.randomUUID(), version, "错误"),
  ).rejects.toThrow("当前活动");
});
it("V2备份含布局与命名方案，新活动恢复保引用；V1继续可读", async () => {
  const s = await repo.snapshot(id);
  await venue.position(id, "table", s.tables[0].id, { x: 350, y: 400 });
  await versions.save(id, "虚构酒店稿");
  const b = await new BackupService(repo).export(id);
  expect(b.schemaVersion).toBe(2);
  expect(decodeBackup(JSON.stringify(b)).checkpoints[0].name).toBe(
    "虚构酒店稿",
  );
  const report = await new BackupService(repo).restore(b, "new");
  const restored = await repo.snapshot(report.firstEventId!);
  expect(restored.tables[0].position).toEqual({ x: 350, y: 400 });
  expect(restored.guests[0].tableId).toBe(restored.tables[1].id);
  const legacy = {
    ...b,
    schemaVersion: 1,
    appVersion: "0.1.0",
    events: [s.event],
    tables: s.tables,
    checkpoints: [],
  };
  expect(decodeBackup(JSON.stringify(legacy)).schemaVersion).toBe(1);
  expect(() =>
    decodeBackup(
      JSON.stringify({ ...b, schemaVersion: 1, appVersion: "0.1.0" }),
    ),
  ).toThrow();
});
it("Dexie2升级3不丢旧活动、组和坐标，旧快照仍可读取", async () => {
  const name = crypto.randomUUID();
  const old = new Dexie(name);
  old.version(2).stores({
    events: "id, updatedAt",
    guests: "id, eventId, tableId, [eventId+tableId]",
    seatingTables: "id, eventId, [eventId+orderIndex]",
    checkpoints: "id, eventId, createdAt",
    localMeta: "key",
  });
  const s = fixture();
  await old.open();
  await old.table("events").add(s.event);
  await old.table("guests").bulkAdd(s.guests);
  await old.table("seatingTables").bulkAdd(s.tables);
  old.close();
  const upgraded = new SeatingDB(name);
  try {
    const actual = await new Repository(upgraded).snapshot(s.event.id);
    expect(fingerprint(parseSnapshot(actual))).toBe(fingerprint(s));
    expect(upgraded.verno).toBe(3);
  } finally {
    await upgraded.delete();
  }
});

it("SVG文本转义、不包含名单，PNG输出有严格像素预算", async () => {
  const { planSvg, pngDimensions } =
    await import("../features/floorplan/planExport");
  const s = fixture();
  s.event.name = '<script>alert("fictional")</script>';
  const result = planSvg(s);
  expect(result.svg).toContain("&lt;script&gt;");
  expect(result.svg).not.toContain("<script>");
  expect(result.svg).not.toContain(s.guests[0].displayName);
  for (const [w, h] of [
    [1200, 950],
    [12000, 12000],
    [400, 12000],
  ]) {
    const p = pngDimensions(w, h);
    expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(4096);
    expect(p.width * p.height).toBeLessThanOrEqual(16_000_000);
  }
  expect(() => pngDimensions(NaN, 20)).toThrow();
});

it("方案重命名和删除也标记备份未覆盖，当前数据备份不能冒称包含历史", async () => {
  const b = new BackupService(repo);
  const version = await versions.save(id, "虚构备份版本");
  await b.markDownloaded(await b.export(id));
  expect(await db.localMeta.get(`historyDirty:${id}`)).toBeUndefined();
  await versions.rename(id, version, "虚构重命名");
  expect(await db.localMeta.get(`historyDirty:${id}`)).toBeDefined();
  await b.markDownloaded(await b.export(id, false));
  expect(await db.localMeta.get(`historyDirty:${id}`)).toBeDefined();
  await b.markDownloaded(await b.export(id));
  expect(await db.localMeta.get(`historyDirty:${id}`)).toBeUndefined();
  await versions.delete(id, version);
  expect(await db.localMeta.get(`historyDirty:${id}`)).toBeDefined();
});

it.each([300, 500])("%s人规则预览、应用计算与场地导出守恒", async (people) => {
  const { planSvg } = await import("../features/floorplan/planExport");
  const seed = fixture(),
    count = people - 3,
    start = performance.now();
  const s = {
    ...seed,
    guests: Array.from({ length: count }, (_, i) => ({
      ...seed.guests[0],
      id: crypto.randomUUID(),
      displayName: `虚构规则${i}`,
      size: i === 0 ? 4 : 1,
      tableId: null,
      attendance: "confirmed" as const,
      orderIndex: i,
    })),
    tables: Array.from({ length: people / 10 }, (_, i) => ({
      ...seed.tables[0],
      id: crypto.randomUUID(),
      label: String(i + 1),
      capacity: 10,
      orderIndex: i,
    })),
  };
  const p = suggestSeating(s, { rule: "category", includeTentative: true });
  const after = applyProposal(s, p);
  expect(calculateEventStats(after)).toMatchObject({
    plannedCount: people,
    assignedCount: people,
    unassignedCount: 0,
  });
  expect(planSvg(after).svg).toContain(`计划 ${people} 人`);
  expect(performance.now() - start).toBeLessThan(3000);
});

it("CRUD输入不可夹带位置/场地字段绕过锁定与布局校验", async () => {
  const s = await repo.snapshot(id);
  await venue.position(id, "table", s.tables[0].id, { x: 400, y: 400 });
  const table = (await repo.snapshot(id)).tables[0];
  await crud.saveTable(id, { ...table, locked: true }, table.id);
  const injected = { ...table, locked: true, position: { x: 1, y: 1 } };
  await crud.saveTable(id, injected, table.id);
  expect((await repo.snapshot(id)).tables[0].position).toEqual({
    x: 400,
    y: 400,
  });
  await crud.updateEvent(id, {
    ...s.event,
    venue: { width: 400, height: 400, areas: [] },
  } as typeof s.event);
  expect((await repo.snapshot(id)).event.venue!.width).toBe(1200);
});

it("复制活动保留当前场地且新活动改区域不污染原活动，版本历史不隐式复制", async () => {
  const s = await repo.snapshot(id);
  await venue.position(id, "table", s.tables[0].id, { x: 400, y: 400 });
  await venue.saveArea(id, {
    kind: "zone",
    label: "虚构接待区",
    x: 700,
    y: 50,
    width: 200,
    height: 80,
  });
  await versions.save(id, "虚构原活动稿");
  const before = await repo.snapshot(id),
    otherId = await crud.copyEvent(id),
    other = await repo.snapshot(otherId);
  expect(other.tables[0].position).toEqual(before.tables[0].position);
  expect(await db.checkpoints.where("eventId").equals(otherId).count()).toBe(0);
  await venue.position(otherId, "area", other.event.venue!.areas[0].id, {
    x: 800,
    y: 100,
  });
  expect(await repo.snapshot(id)).toEqual(before);
  await expect(
    venue.position(otherId, "table", before.tables[0].id, { x: 300, y: 300 }),
  ).rejects.toThrow("当前活动");
});

it("场地图演示是原子创建的全虚构12桌场景，保留同名、待定和未排", async () => {
  const { createVenueDemo } =
    await import("../features/events/venueDemoService");
  const demoId = await createVenueDemo(repo),
    s = await repo.snapshot(demoId);
  expect(calculateEventStats(s)).toMatchObject({
    tableCount: 12,
    totalRecordedCount: 123,
    plannedCount: 122,
    assignedCount: 120,
    unassignedCount: 2,
  });
  expect(s.event.venue!.areas).toHaveLength(3);
  expect(layoutWarnings(s)).toHaveLength(0);
  expect(s.guests.filter((g) => g.displayName === "虚构同名来宾")).toHaveLength(
    2,
  );
  expect((await repo.snapshot(id)).event.name).toBe("虚构测试婚宴");
});

it("方案对比明确显示区域类型变化，不把舞台改入口显示成相同值", () => {
  const s = fixture();
  s.event.venue = {
    width: 1200,
    height: 800,
    areas: [
      {
        id: crypto.randomUUID(),
        kind: "stage",
        label: "虚构区域",
        x: 700,
        y: 40,
        width: 200,
        height: 80,
      },
    ],
  };
  const next = structuredClone(s);
  next.event.venue!.areas[0].kind = "entrance";
  const change = compareSnapshots(s, next).find((c) => c.kind === "区域变化")!;
  expect(change.before).toContain("舞台");
  expect(change.after).toContain("入口");
});

it("换桌菜单按整组人数说明余席和锁定原因，当前桌保留可选且不修改快照", async () => {
  const { tableChoices } = await import("../features/seating/tableChoices");
  const snapshot = fixture();
  const family = snapshot.guests[0];
  snapshot.tables[0].capacity = 3;
  snapshot.tables[2].locked = true;
  const before = structuredClone(snapshot);
  const choices = tableChoices(snapshot, family);
  expect(choices[0]).toMatchObject({
    disabled: true,
    label: "01 桌 · 余 3 席 · 差 1 席",
  });
  expect(choices[1]).toMatchObject({
    disabled: false,
    label: "03 桌 · 余 6 席 · 当前桌",
  });
  expect(choices[2]).toMatchObject({
    disabled: true,
    label: "66 桌 · 余 10 席 · 已锁定",
  });
  snapshot.tables[0].capacity = 4;
  expect(tableChoices(snapshot, family)[0].disabled).toBe(false);
  snapshot.tables[0].capacity = 3;
  expect(snapshot).toEqual(before);
});
