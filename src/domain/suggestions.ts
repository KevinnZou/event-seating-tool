import type { Snapshot } from "./models";
import { occupancy } from "./calculations";
import { fingerprint, parseSnapshot } from "./snapshots";
import { repository, type Repository } from "../db/repository";
import { WorkspaceService } from "./workspaceService";
import { CheckpointService } from "./checkpointService";
export type SeatingRule = "compact" | "category" | "balanced";
export interface SuggestionOptions {
  rule: SeatingRule;
  includeTentative: boolean;
}
export interface SeatingProposal {
  base: string;
  options: SuggestionOptions;
  assignments: { guestId: string; tableId: string; reason: string }[];
  remaining: { guestId: string; reason: string }[];
}
export function suggestSeating(
  input: Snapshot,
  options: SuggestionOptions,
): SeatingProposal {
  const s = parseSnapshot(input);
  if (
    !["compact", "category", "balanced"].includes(options.rule) ||
    typeof options.includeTentative !== "boolean"
  )
    throw new Error("排桌规则无效");
  const used = new Map(s.tables.map((t) => [t.id, occupancy(s, t.id)]));
  const categories = new Map(
    s.tables.map((t) => [t.id, new Map<string, number>()]),
  );
  for (const g of s.guests)
    if (g.tableId && g.category?.trim() && g.attendance !== "declined") {
      const counts = categories.get(g.tableId)!;
      counts.set(
        g.category.trim(),
        (counts.get(g.category.trim()) ?? 0) + g.size,
      );
    }
  const assignments: SeatingProposal["assignments"] = [],
    remaining: SeatingProposal["remaining"] = [];
  // Stable ordering and whole groups: largest first reduces avoidable fragmentation.
  const pending = s.guests
    .filter((g) => !g.tableId && g.attendance !== "declined")
    .sort(
      (a, b) =>
        b.size - a.size ||
        a.orderIndex - b.orderIndex ||
        a.id.localeCompare(b.id),
    );
  for (const guest of pending) {
    if (!options.includeTentative && guest.attendance === "tentative") {
      remaining.push({ guestId: guest.id, reason: "本次未包含待定宾客" });
      continue;
    }
    const candidates = s.tables.filter(
      (t) => !t.locked && t.capacity - used.get(t.id)! >= guest.size,
    );
    candidates.sort((a, b) => {
      if (options.rule === "category" && guest.category?.trim()) {
        const score = (id: string) =>
          categories.get(id)!.get(guest.category!.trim()) ?? 0;
        const affinity = score(b.id) - score(a.id);
        if (affinity) return affinity;
      }
      const balance =
        options.rule === "balanced"
          ? used.get(a.id)! / a.capacity - used.get(b.id)! / b.capacity
          : a.capacity - used.get(a.id)! - (b.capacity - used.get(b.id)!);
      return balance || a.orderIndex - b.orderIndex || a.id.localeCompare(b.id);
    });
    const table = candidates[0];
    if (!table) {
      remaining.push({
        guestId: guest.id,
        reason: "未锁定桌没有足够连续整组余席；不拆组、不移动已有安排",
      });
      continue;
    }
    const category = guest.category?.trim();
    const affinity = category
      ? (categories.get(table.id)!.get(category) ?? 0)
      : 0;
    const reason =
      options.rule === "category" && affinity
        ? `同分组优先：本桌已有“${category}”${affinity}人`
        : options.rule === "balanced"
          ? "均衡占用：选择当前占用比例较低且可容纳整组的桌"
          : "紧凑安排：优先利用可容纳整组的较小余席";
    used.set(table.id, used.get(table.id)! + guest.size);
    if (category)
      categories.get(table.id)!.set(category, affinity + guest.size);
    assignments.push({ guestId: guest.id, tableId: table.id, reason });
  }
  return {
    base: fingerprint(s),
    options: { ...options },
    assignments,
    remaining,
  };
}
export function applyProposal(
  s: Snapshot,
  proposal: SeatingProposal,
): Snapshot {
  if (fingerprint(s) !== proposal.base)
    throw new Error("预览后数据已变化，请重新生成建议");
  const expected = suggestSeating(s, proposal.options);
  if (JSON.stringify(expected) !== JSON.stringify(proposal))
    throw new Error("建议内容不完整或已改变，请重新生成");
  const ids = new Map(proposal.assignments.map((a) => [a.guestId, a.tableId]));
  return parseSnapshot({
    ...s,
    guests: s.guests.map((g) =>
      ids.has(g.id)
        ? { ...g, tableId: ids.get(g.id)!, updatedAt: new Date().toISOString() }
        : g,
    ),
  });
}
export class SuggestionService {
  readonly repo: Repository;
  constructor(repo: Repository = repository) {
    this.repo = repo;
  }
  apply(eventId: string, proposal: SeatingProposal) {
    return this.repo.transaction(async () => {
      const s = await this.repo.snapshot(eventId);
      const after = applyProposal(s, proposal);
      if (!proposal.assignments.length) throw new Error("没有可应用的安排");
      await new CheckpointService(this.repo).create(eventId, "bulk-edit");
      await new WorkspaceService(this.repo).replace(after);
    });
  }
}
export const suggestionService = new SuggestionService();
