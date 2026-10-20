import { z } from "zod";
import type { Snapshot } from "./models";
import { parseSnapshot } from "./snapshots";
import { repository, type Repository } from "../db/repository";
import { CheckpointService } from "./checkpointService";
export interface VersionChange {
  kind: string;
  label: string;
  before: string;
  after: string;
}
const nameSchema = z.string().trim().min(1, "请填写方案名称").max(80);
const display = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? "未设置"
    : String(value);
export function compareSnapshots(
  beforeInput: Snapshot,
  afterInput: Snapshot,
): VersionChange[] {
  const before = parseSnapshot(beforeInput),
    after = parseSnapshot(afterInput);
  if (before.event.id !== after.event.id)
    throw new Error("只能比较同一活动的方案");
  const changes: VersionChange[] = [];
  const add = (kind: string, label: string, a: unknown, b: unknown) =>
    changes.push({ kind, label, before: display(a), after: display(b) });
  const tableName = (s: Snapshot, id: string | null) =>
    id ? (s.tables.find((t) => t.id === id)?.label ?? "无效桌位") : "未安排";
  const guestInfo = (s: Snapshot, g: Snapshot["guests"][number]) =>
    `${g.displayName}（${g.size}人） · ${g.attendance} · ${tableName(s, g.tableId)}`;
  for (const guest of before.guests) {
    const next = after.guests.find((g) => g.id === guest.id);
    if (!next) {
      add("删除组", guest.displayName, guestInfo(before, guest), "已删除");
      continue;
    }
    for (const [key, label] of [
      ["displayName", "名称"],
      ["size", "人数"],
      ["attendance", "出席"],
      ["category", "分组"],
      ["note", "备注"],
      ["kind", "组类型"],
      ["originGroupId", "拆分来源"],
      ["orderIndex", "名单排序"],
    ] as const)
      if (guest[key] !== next[key])
        add(label, guest.displayName, guest[key], next[key]);
    if (guest.tableId !== next.tableId)
      add(
        "调桌",
        next.displayName,
        tableName(before, guest.tableId),
        tableName(after, next.tableId),
      );
  }
  for (const guest of after.guests)
    if (!before.guests.some((g) => g.id === guest.id))
      add("新增组", guest.displayName, "不存在", guestInfo(after, guest));
  for (const table of before.tables) {
    const next = after.tables.find((t) => t.id === table.id);
    if (!next) {
      add("删除桌", table.label, `${table.capacity}席`, "已删除");
      continue;
    }
    for (const [key, label] of [
      ["label", "桌号"],
      ["capacity", "桌容量"],
      ["locked", "锁定"],
      ["note", "桌备注"],
      ["orderIndex", "桌排序"],
    ] as const)
      if (table[key] !== next[key])
        add(label, table.label, table[key], next[key]);
    if (JSON.stringify(table.position) !== JSON.stringify(next.position))
      add(
        "桌位置",
        next.label,
        JSON.stringify(table.position),
        JSON.stringify(next.position),
      );
  }
  for (const table of after.tables)
    if (!before.tables.some((t) => t.id === table.id))
      add("新增桌", table.label, "不存在", `${table.capacity}席`);
  for (const [key, label] of [
    ["name", "活动名称"],
    ["type", "活动类型"],
    ["date", "活动日期"],
    ["defaultCapacity", "默认容量"],
    ["overCapacityPolicy", "超员策略"],
  ] as const)
    if (before.event[key] !== after.event[key])
      add(label, "活动设置", before.event[key], after.event[key]);
  if (JSON.stringify(before.event.venue) !== JSON.stringify(after.event.venue))
    add(
      "场地区域",
      "画布与区域",
      JSON.stringify(before.event.venue),
      JSON.stringify(after.event.venue),
    );
  return changes;
}
export class VersionService {
  readonly repo: Repository;
  constructor(repo: Repository = repository) {
    this.repo = repo;
  }
  save(eventId: string, name: string) {
    const safe = nameSchema.parse(name);
    return this.repo.transaction(async () => {
      const id = await new CheckpointService(this.repo).create(eventId);
      await this.repo.database.checkpoints.update(id, { name: safe });
      return id;
    });
  }
  rename(eventId: string, id: string, name: string) {
    const safe = nameSchema.parse(name);
    return this.repo.transaction(async () => {
      const cp = await this.repo.database.checkpoints.get(id);
      if (!cp || cp.eventId !== eventId || !cp.name)
        throw new Error("方案不属于当前活动");
      await this.repo.database.checkpoints.update(id, { name: safe });
    });
  }
  restore(eventId: string, id: string) {
    return new CheckpointService(this.repo).restore(eventId, id);
  }
  delete(eventId: string, id: string) {
    return new CheckpointService(this.repo).delete(eventId, id);
  }
}
export const versionService = new VersionService();
