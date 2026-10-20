import { it, expect, beforeEach, afterEach } from "vitest";
import { SeatingDB } from "../db/database";
import { Repository } from "../db/repository";
import { SeatingService } from "../domain/services";
import { WorkspaceService } from "../domain/workspaceService";
import { CheckpointService } from "../domain/checkpointService";
import { ImportService } from "../features/import/importService";
import {
  BackupService,
  bundleSnapshots,
} from "../features/export/backupService";
import {
  decodeBackup,
  parseBackup,
  remapBackup,
} from "../features/export/backup";
import { fingerprint } from "../domain/snapshots";
import { calculateEventStats } from "../domain/calculations";
import { parseText } from "../features/import/parsers";
let db: SeatingDB,
  repo: Repository,
  crud: SeatingService,
  backups: BackupService,
  id: string;
beforeEach(async () => {
  db = new SeatingDB(crypto.randomUUID());
  repo = new Repository(db);
  crud = new SeatingService(repo);
  backups = new BackupService(repo);
  id = await crud.createEvent(
    { name: "虚构备份活动", type: "wedding", defaultCapacity: 15 },
    3,
  );
  await crud.saveGuest(id, {
    displayName: "虚构中文一家",
    size: 4,
    kind: "family",
    attendance: "confirmed",
    note: "含中文、换行\n与标点",
  });
  const s = await repo.snapshot(id);
  await crud.moveGuestGroup(id, s.guests[0].id, s.tables[0].id);
  await new CheckpointService(repo).create(id);
});
afterEach(() => db.delete());
it("全量导出清空恢复无损，跨活动隔离与检查点完整", async () => {
  await crud.createEvent({
    name: "虚构第二活动",
    type: "annual-party",
    defaultCapacity: 10,
  });
  const b = decodeBackup(JSON.stringify(await backups.export()));
  await backups.clearAll("清空全部本地数据");
  const report = await backups.restore(b, "overwrite", "覆盖所选活动");
  expect(report).toMatchObject({
    events: 2,
    groups: 1,
    tables: 3,
    planned: 4,
    assigned: 4,
    checkpoints: 1,
  });
  expect(fingerprint(await repo.snapshot(id))).toEqual(
    fingerprint(bundleSnapshots(b).find((s) => s.event.id === id)!),
  );
  expect(await db.checkpoints.count()).toBe(1);
});
it("默认新活动重建所有ID及检查点引用，原数据不变", async () => {
  const b = await backups.export(id),
    before = await repo.snapshot(id);
  const result = await backups.restore(b, "new");
  expect(result.firstEventId).not.toBe(id);
  const restored = await repo.snapshot(result.firstEventId!);
  expect(calculateEventStats(restored)).toEqual(calculateEventStats(before));
  expect(await repo.snapshot(id)).toEqual(before);
  const cp = (
    await db.checkpoints.where("eventId").equals(result.firstEventId!).toArray()
  )[0];
  expect((cp.snapshot as { event: { id: string } }).event.id).toBe(
    result.firstEventId,
  );
});
it("非法引用、重复ID、未知版本和损坏JSON都拒绝", async () => {
  const b = await backups.export();
  expect(() => decodeBackup("{")).toThrow("JSON");
  expect(() => parseBackup({ ...b, schemaVersion: 99 })).toThrow();
  expect(() =>
    parseBackup({ ...b, guestGroups: [...b.guestGroups, b.guestGroups[0]] }),
  ).toThrow("重复");
  expect(() =>
    parseBackup({
      ...b,
      guestGroups: [{ ...b.guestGroups[0], tableId: crypto.randomUUID() }],
    }),
  ).toThrow("不存在");
  expect(await db.guests.toArray()).toHaveLength(1);
});
it("覆盖保护其他活动，需确认且自动保留覆盖前检查点", async () => {
  const b = await backups.export(id);
  await crud.saveGuest(id, {
    displayName: "虚构新增",
    size: 2,
    kind: "person",
    attendance: "confirmed",
  });
  const other = await crud.createEvent({
    name: "虚构外部活动",
    type: "banquet",
    defaultCapacity: 10,
  });
  await expect(backups.restore(b, "overwrite")).rejects.toThrow("确认");
  await backups.restore(b, "overwrite", "覆盖所选活动");
  expect((await repo.snapshot(id)).guests).toHaveLength(1);
  expect((await repo.snapshot(other)).event.name).toBe("虚构外部活动");
  expect(await db.checkpoints.where("eventId").equals(id).count()).toBe(2);
});
it("导入失败回滚不建检查点；成功和替换前建立可恢复检查点", async () => {
  const imp = new ImportService(repo),
    before = await repo.snapshot(id);
  await expect(
    imp.commit(
      id,
      parseText("01号桌：虚构大组(99)"),
      "append",
      false,
      fingerprint(before),
      "",
    ),
  ).rejects.toThrow();
  expect(await db.checkpoints.count()).toBe(1);
  await imp.commit(
    id,
    parseText("虚构新名单(2)"),
    "replace",
    false,
    fingerprint(before),
    before.event.name,
  );
  expect(calculateEventStats(await repo.snapshot(id)).plannedCount).toBe(2);
  const cp = (await db.checkpoints.where("eventId").equals(id).toArray()).find(
    (cp) => cp.reason === "import",
  )!;
  await new CheckpointService(repo).restore(id, cp.id);
  expect(calculateEventStats(await repo.snapshot(id)).plannedCount).toBe(4);
});
it("拆分后的origin引用在新活动恢复后仍完整", async () => {
  const s = await repo.snapshot(id);
  await new WorkspaceService(repo).split(id, s.guests[0].id, [
    { name: "虚构甲", size: 2 },
    { name: "虚构乙", size: 2 },
  ]);
  const restored = remapBackup(await backups.export(id));
  expect(restored.guestGroups.find((g) => g.originGroupId)?.originGroupId).toBe(
    restored.guestGroups.find((g) => !g.originGroupId)?.id,
  );
});
