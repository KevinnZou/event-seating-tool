import { pinyin } from "pinyin-pro";
import type { Snapshot, GuestGroupEntity } from "../../domain/models";
export interface Filters {
  guestId?: string;
  query: string;
  attendance: string;
  category: string;
  table: string;
  sort: string;
}
export const initialFilters: Filters = {
  query: "",
  attendance: "",
  category: "",
  table: "",
  sort: "order",
};
const collator = new Intl.Collator("zh-CN", { numeric: true });
export function searchText(value: string) {
  const full = pinyin(value, { toneType: "none" });
  return `${value} ${full} ${full.replaceAll(" ", "")} ${full
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")}`.toLowerCase();
}
export function filterGuests(s: Snapshot, f: Filters): GuestGroupEntity[] {
  const q = f.query.toLowerCase().trim();
  const result = s.guests.filter(
    (g) =>
      (!f.guestId || g.id === f.guestId) &&
      (!q || searchText(`${g.displayName} ${g.category ?? ""}`).includes(q)) &&
      (!f.attendance || g.attendance === f.attendance) &&
      (!f.category || g.category === f.category) &&
      (!f.table ||
        (f.table === "unassigned"
          ? g.tableId === null && g.attendance !== "declined"
          : g.tableId === f.table)),
  );
  return result.sort((a, b) =>
    f.sort === "name"
      ? collator.compare(a.displayName, b.displayName)
      : f.sort === "category"
        ? collator.compare(a.category ?? "", b.category ?? "")
        : f.sort === "table"
          ? collator.compare(
              s.tables.find((t) => t.id === a.tableId)?.label ?? "~",
              s.tables.find((t) => t.id === b.tableId)?.label ?? "~",
            )
          : a.orderIndex - b.orderIndex,
  );
}
