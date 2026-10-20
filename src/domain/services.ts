import { layoutErrors } from "./geometry";
import { Repository, repository } from "../db/repository";
import {
  eventSchema,
  eventInputSchema,
  guestInputSchema,
  tableInputSchema,
  guestSchema,
  tableSchema,
  type EventInput,
  type GuestInput,
  type TableInput,
} from "./models";
import {
  assertCapacity,
  normalizeTableLabel,
  occupancy,
  nextOrderIndex,
  validateEvent,
} from "./calculations";
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
export class SeatingService {
  readonly repo: Repository;
  constructor(repo: Repository = repository) {
    this.repo = repo;
  }
  private touch(eventId: string) {
    return this.repo.database.events.update(eventId, { updatedAt: now() });
  }
  async createEvent(input: EventInput, initialTables = 0) {
    if (
      !Number.isInteger(initialTables) ||
      initialTables < 0 ||
      initialTables > 100
    )
      throw new Error("初始桌数须为 0–100");
    const event = eventSchema.parse({
      ...eventInputSchema.parse(input),
      date: input.date || undefined,
      id: uuid(),
      createdAt: now(),
      updatedAt: now(),
      schemaVersion: 1,
      overCapacityPolicy: "block",
    });
    return this.repo.transaction(async () => {
      await this.repo.database.events.add(event);
      for (let i = 0; i < initialTables; i++)
        await this.repo.database.seatingTables.add(
          tableSchema.parse({
            id: uuid(),
            eventId: event.id,
            label: String(i + 1).padStart(2, "0"),
            capacity: event.defaultCapacity,
            orderIndex: i,
            locked: false,
            createdAt: now(),
            updatedAt: now(),
          }),
        );
      return event.id;
    });
  }
  updateEvent(eventId: string, input: EventInput) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      await this.repo.database.events.put(
        eventSchema.parse({
          ...s.event,
          ...eventInputSchema.parse(input),
          date: input.date || undefined,
          updatedAt: now(),
        }),
      );
    });
  }
  copyEvent(eventId: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      if (
        validateEvent(s).some((issue) => issue.severity === "error") ||
        s.guests.some(
          (g) =>
            g.originGroupId &&
            !s.guests.some((source) => source.id === g.originGroupId),
        )
      )
        throw new Error("活动存在完整性错误，请修复后再复制");
      const newId = uuid();
      const map = new Map(s.tables.map((t) => [t.id, uuid()]));
      const groupIds = new Map(s.guests.map((g) => [g.id, uuid()]));
      await this.repo.database.events.add({
        ...s.event,
        id: newId,
        name: `${s.event.name.slice(0, 90)}（副本）`,
        createdAt: now(),
        updatedAt: now(),
      });
      await this.repo.database.seatingTables.bulkAdd(
        s.tables.map((t) => ({
          ...t,
          id: map.get(t.id)!,
          eventId: newId,
          createdAt: now(),
          updatedAt: now(),
        })),
      );
      await this.repo.database.guests.bulkAdd(
        s.guests.map((g) => ({
          ...g,
          id: groupIds.get(g.id)!,
          eventId: newId,
          tableId: g.tableId ? (map.get(g.tableId) ?? null) : null,
          originGroupId: g.originGroupId
            ? groupIds.get(g.originGroupId)
            : undefined,
          createdAt: now(),
          updatedAt: now(),
        })),
      );
      return newId;
    });
  }
  deleteEvent(eventId: string, confirmation: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      if (confirmation !== s.event.name)
        throw new Error("活动名不匹配，未删除");
      const d = this.repo.database;
      await d.guests.where("eventId").equals(eventId).delete();
      await d.seatingTables.where("eventId").equals(eventId).delete();
      await d.checkpoints.where("eventId").equals(eventId).delete();
      await d.localMeta.delete(`backup:${eventId}`);
      await d.localMeta.delete(`historyDirty:${eventId}`);
      await d.events.delete(eventId);
    });
  }
  saveTable(eventId: string, input: TableInput, id?: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const old = id ? s.tables.find((t) => t.id === id) : undefined;
      if (id && !old) throw new Error("桌位不存在");
      if (
        old?.locked &&
        (input.label !== old.label ||
          input.capacity !== old.capacity ||
          input.note !== old.note)
      )
        throw new Error("请先解锁桌位");
      const t = tableSchema.parse({
        ...old,
        ...tableInputSchema.parse(input),
        id: old?.id ?? uuid(),
        eventId,
        orderIndex: old?.orderIndex ?? nextOrderIndex(s.tables),
        createdAt: old?.createdAt ?? now(),
        updatedAt: now(),
      });
      if (
        s.tables.some(
          (other) =>
            other.id !== t.id &&
            normalizeTableLabel(other.label) === normalizeTableLabel(t.label),
        )
      )
        throw new Error("桌号重复（01 与 1 视为同号）");
      if (occupancy(s, t.id) > t.capacity)
        throw new Error("容量不能小于已安排人数");
      const geometry = layoutErrors({
        ...s,
        tables: old
          ? s.tables.map((table) => (table.id === t.id ? t : table))
          : [...s.tables, t],
      });
      if (geometry.length) throw new Error(geometry.join("；"));
      await this.repo.database.seatingTables.put(t);
      await this.touch(eventId);
    });
  }
  saveGuest(
    eventId: string,
    input: GuestInput,
    id?: string,
    confirmRelease = false,
  ) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const old = id ? s.guests.find((g) => g.id === id) : undefined;
      if (id && !old) throw new Error("宾客组不存在");
      if (old?.tableId && s.tables.find((t) => t.id === old.tableId)?.locked)
        throw new Error("请先解锁所在桌位");
      if (old?.tableId && input.attendance === "declined" && !confirmRelease)
        throw new Error("需确认将宾客迁回未安排区");
      const g = guestSchema.parse({
        ...old,
        ...guestInputSchema.parse(input),
        id: old?.id ?? uuid(),
        eventId,
        tableId:
          input.attendance === "declined" ? null : (old?.tableId ?? null),
        orderIndex: old?.orderIndex ?? nextOrderIndex(s.guests),
        createdAt: old?.createdAt ?? now(),
        updatedAt: now(),
      });
      assertCapacity(s, g.id, g.tableId, g.size, g.attendance);
      await this.repo.database.guests.put(g);
      await this.touch(eventId);
    });
  }
  moveGuestGroup(
    eventId: string,
    guestId: string,
    targetTableId: string | null,
  ) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const g = s.guests.find((g) => g.id === guestId);
      if (!g) throw new Error("宾客不属于当前活动");
      if (
        s.tables.some(
          (t) => t.locked && (t.id === g.tableId || t.id === targetTableId),
        )
      )
        throw new Error("请先解锁桌位");
      assertCapacity(s, g.id, targetTableId, g.size, g.attendance);
      await this.repo.database.guests.update(g.id, {
        tableId: targetTableId,
        updatedAt: now(),
      });
      await this.touch(eventId);
    });
  }
  setAttendance(
    eventId: string,
    guestId: string,
    attendance: GuestInput["attendance"],
    confirmRelease = false,
  ) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const g = s.guests.find((g) => g.id === guestId);
      if (!g) throw new Error("宾客不存在");
      await this.saveGuest(
        eventId,
        { ...g, attendance },
        guestId,
        confirmRelease,
      );
    });
  }
  deleteGuest(eventId: string, guestId: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const g = s.guests.find((g) => g.id === guestId);
      if (!g) throw new Error("宾客不存在");
      if (s.tables.some((t) => t.id === g.tableId && t.locked))
        throw new Error("请先解锁桌位");
      if (s.guests.some((item) => item.originGroupId === guestId))
        throw new Error("此组有拆分来源关联，请通过批量选择同时删除关联组");
      await this.repo.database.guests.delete(guestId);
      await this.touch(eventId);
    });
  }
  deleteTable(eventId: string, tableId: string) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const t = s.tables.find((t) => t.id === tableId);
      if (!t) throw new Error("桌位不存在");
      if (t.locked) throw new Error("请先解锁桌位");
      for (const g of s.guests.filter((g) => g.tableId === tableId))
        await this.repo.database.guests.update(g.id, {
          tableId: null,
          updatedAt: now(),
        });
      await this.repo.database.seatingTables.delete(tableId);
      await this.touch(eventId);
    });
  }
}
export const seatingService = new SeatingService();
