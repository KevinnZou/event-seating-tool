import { pinyin } from "pinyin-pro";
import type { Snapshot, GuestGroupEntity } from "../../domain/models";
export interface Filters {
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
  return `${value} ${pinyin(value, { toneType: "none" })} ${pinyin(value, { toneType: "none" }).replaceAll(" ", "")} ${pinyin(value, { pattern: "first", toneType: "none" }).replaceAll(" ", "")}`.toLowerCase();
}
export function filterGuests(s: Snapshot, f: Filters): GuestGroupEntity[] {
  const q = f.query.toLowerCase().trim();
  const result = s.guests.filter(
    (g) =>
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
