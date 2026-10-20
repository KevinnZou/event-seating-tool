import { repository, type Repository } from "../../db/repository";
import { parseBackup, remapBackup, type Backup } from "./backup";
import { calculateEventStats } from "../../domain/calculations";
import type { Snapshot } from "../../domain/models";
export class BackupService {
  readonly repo: Repository;
  constructor(repo = repository) {
    this.repo = repo;
  }
  export(eventId?: string, includeCheckpoints = true) {
    const d = this.repo.database;
    return d.transaction(
      "r",
      [d.events, d.guests, d.seatingTables, d.checkpoints],
      async () => {
        const events = eventId
            ? [await this.repo.snapshot(eventId)].map((s) => s.event)
            : await d.events.toArray(),
          ids = new Set(events.map((e) => e.id));
        return parseBackup({
          format: "event-seating-backup",
          schemaVersion: 1,
          appVersion: "0.1.0",
          exportedAt: new Date().toISOString(),
          scope: eventId ? "single-event" : "all-events",
          events,
          tables: (await d.seatingTables.toArray()).filter((t) =>
            ids.has(t.eventId),
          ),
          guestGroups: (await d.guests.toArray()).filter((g) =>
            ids.has(g.eventId),
          ),
          checkpoints: includeCheckpoints
            ? (await d.checkpoints.toArray()).filter((cp) =>
                ids.has(cp.eventId),
              )
            : [],
        });
      },
    );
  }
  markDownloaded(b: Backup) {
    return this.repo.transaction(async () => {
      for (const event of b.events)
        await this.repo.database.localMeta.put({
          key: `backup:${event.id}`,
          value: b.exportedAt,
        });
      await this.repo.database.localMeta.put({
        key: "lastBackup",
        value: b.exportedAt,
      });
    });
  }
  restore(input: Backup, mode: "new" | "overwrite", confirmation = "") {
    const parsed = parseBackup(input);
    const bundle = mode === "new" ? remapBackup(parsed) : parsed;
    return this.repo.transaction(async () => {
      if (mode === "overwrite" && confirmation !== "覆盖所选活动")
        throw new Error("覆盖前须明确确认");
      const d = this.repo.database,
        targetIds = new Set(bundle.events.map((e) => e.id));
      for (const [store, records] of [
        [d.seatingTables, bundle.tables],
        [d.guests, bundle.guestGroups],
        [d.checkpoints, bundle.checkpoints],
      ] as const) {
        for (const record of records) {
          const old = await store.get(record.id);
          if (old && !targetIds.has(old.eventId))
            throw new Error("ID与其他活动冲突，未写入任何数据");
        }
      }
      const safeguards: Backup["checkpoints"] = [];
      if (mode === "overwrite") {
        for (const event of bundle.events) {
          if (await d.events.get(event.id)) {
            safeguards.push({
              id: crypto.randomUUID(),
              eventId: event.id,
              createdAt: new Date().toISOString(),
              reason: "bulk-edit",
              snapshot: await this.repo.snapshot(event.id),
            });
          }
          await d.guests.where("eventId").equals(event.id).delete();
          await d.seatingTables.where("eventId").equals(event.id).delete();
          await d.checkpoints.where("eventId").equals(event.id).delete();
        }
      } else if (
        (await d.events.bulkGet(bundle.events.map((e) => e.id))).some(Boolean)
      )
        throw new Error("新活动ID冲突，请重试");
      await d.events.bulkPut(bundle.events);
      await d.seatingTables.bulkAdd(bundle.tables);
      await d.guests.bulkAdd(bundle.guestGroups);
      await d.checkpoints.bulkAdd([...bundle.checkpoints, ...safeguards]);
      const expected = bundle.events.map((event) => ({
        event,
        tables: bundle.tables.filter((t) => t.eventId === event.id),
        guests: bundle.guestGroups.filter((g) => g.eventId === event.id),
      }));
      let planned = 0,
        assigned = 0;
      for (const s of expected) {
        const actual = await this.repo.snapshot(s.event.id);
        if (
          JSON.stringify(calculateEventStats(s)) !==
          JSON.stringify(calculateEventStats(actual))
        )
          throw new Error("恢复后统计不一致，事务已回滚");
        planned += calculateEventStats(actual).plannedCount;
        assigned += calculateEventStats(actual).assignedCount;
      }
      return {
        events: bundle.events.length,
        groups: bundle.guestGroups.length,
        tables: bundle.tables.length,
        checkpoints: bundle.checkpoints.length,
        planned,
        assigned,
        firstEventId: bundle.events[0]?.id,
      };
    });
  }
  clearAll(confirmation: string) {
    if (confirmation !== "清空全部本地数据") throw new Error("确认文本不匹配");
    return this.repo.transaction(async () => {
      const d = this.repo.database;
      await d.events.clear();
      await d.guests.clear();
      await d.seatingTables.clear();
      await d.checkpoints.clear();
      await d.localMeta.clear();
    });
  }
}
export const backupService = new BackupService();
export function bundleSnapshots(b: Backup): Snapshot[] {
  return b.events.map((event) => ({
    event,
    tables: b.tables.filter((t) => t.eventId === event.id),
    guests: b.guestGroups.filter((g) => g.eventId === event.id),
  }));
}
