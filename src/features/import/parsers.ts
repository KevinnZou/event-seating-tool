import Papa from "papaparse";
export interface DraftRow {
  id: string;
  line: number;
  raw: string;
  name: string;
  size: string;
  category: string;
  table: string;
  attendance: string;
  note: string;
  targetId?: string;
  included: boolean;
  review: boolean;
}
export const fields = [
  "name",
  "size",
  "category",
  "table",
  "attendance",
  "note",
] as const;
export type Field = (typeof fields)[number];
export type Mapping = Record<Field, number>;
export const fieldLabels: Record<Field, string> = {
  name: "名称",
  size: "人数",
  category: "分组",
  table: "桌号",
  attendance: "状态",
  note: "备注",
};
export const emptyRow = (line: number, raw: string): DraftRow => ({
  id: crypto.randomUUID(),
  line,
  raw,
  name: "",
  size: "1",
  category: "",
  table: "",
  attendance: "confirmed",
  note: "",
  included: true,
  review: false,
});
export function parseText(text: string): DraftRow[] {
  if (text.length > 1_000_000) throw new Error("文本过长，最多100万字符");
  const rows: DraftRow[] = [];
  let table = "";
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    let raw = line.trim();
    if (!raw) continue;
    const heading = raw.match(/^(.{1,40}?)号桌\s*[：:](.*)$/);
    if (heading) {
      table = heading[1].trim();
      raw = heading[2].trim();
      if (!raw) continue;
    }
    const parts = raw.includes("、") ? raw.split("、") : [raw];
    for (const part of parts) {
      if (!part.trim()) continue;
      const r = emptyRow(index + 1, line);
      r.table = table;
      let value = part.trim();
      const braces = value.match(/\{[^}]*\}/g);
      if (braces) {
        r.note = braces.join(" ");
        r.review = true;
        value = value.replace(/\{[^}]*\}/g, "").trim();
      }
      if (/[,，\t]/.test(value)) {
        const cells =
          Papa.parse<string[]>(value.replaceAll("，", ",")).data[0] ?? [];
        r.name = cells[0]?.trim() ?? "";
        r.size = cells[1]?.trim() ?? "";
        r.category = cells[2]?.trim() ?? "";
        if (cells.length > 3) r.review = true;
      } else {
        const count = value.match(/^(.*?)\s*[（(]\s*(\d+)\s*[）)]$/);
        r.name = count ? count[1].trim() : value;
        r.size = count
          ? count[2]
          : /(夫妻|一家|团队|家庭|[（(])/.test(value)
            ? ""
            : "1";
      }
      rows.push(r);
      if (rows.length > 5000) throw new Error("最多导入5000组，请分批处理");
    }
  }
  return rows;
}
export function parseCsv(text: string) {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  if (result.errors.length)
    throw new Error(`CSV格式错误：${result.errors[0].message}`);
  if (result.data.length > 5001 || result.data.some((row) => row.length > 100))
    throw new Error("最多5000行、100列");
  return result.data;
}
export function guessMapping(header: string[]): Mapping {
  const aliases: Record<Field, string[]> = {
    name: ["名称", "姓名", "宾客", "组名", "name"],
    size: ["人数", "数量", "size"],
    category: ["分组", "分类", "关系", "category"],
    table: ["桌号", "桌位", "table"],
    attendance: ["状态", "出席", "attendance"],
    note: ["备注", "note"],
  };
  return Object.fromEntries(
    fields.map((f) => [
      f,
      header.findIndex((h) => aliases[f].includes(h.trim().toLowerCase())),
    ]),
  ) as Mapping;
}
export function mapRows(cells: string[][], mapping: Mapping, header = true) {
  return cells.slice(header ? 1 : 0).map((values, i) => {
    const r = emptyRow(i + (header ? 2 : 1), values.join(" | "));
    for (const f of fields) {
      const v = mapping[f] < 0 ? "" : (values[mapping[f]] ?? "");
      if (f === "name") r.name = v.trim();
      else r[f] = v.trim();
    }
    if (mapping.size < 0) {
      r.size = "";
    }
    const states: Record<string, string> = {
      确认: "confirmed",
      待定: "tentative",
      不参加: "declined",
      confirmed: "confirmed",
      tentative: "tentative",
      declined: "declined",
    };
    r.attendance =
      mapping.attendance < 0
        ? "confirmed"
        : (states[r.attendance] ?? r.attendance);
    return r;
  });
}
export function rowErrors(r: DraftRow) {
  const result: string[] = [];
  if (
    [r.name, r.size, r.category, r.table, r.note].some((v) =>
      v.includes("[公式需人工替换]"),
    )
  )
    result.push("公式单元格需人工替换为文字");
  if (!r.name.trim() || r.name.trim().length > 100)
    result.push("名称需1–100字");
  if (
    !/^\d+$/.test(r.size) ||
    !Number.isInteger(Number(r.size)) ||
    Number(r.size) < 1 ||
    Number(r.size) > 999
  )
    result.push("人数需1–999整数");
  if (!["confirmed", "tentative", "declined"].includes(r.attendance))
    result.push("出席状态无效");
  if (r.table.length > 40 || r.category.length > 100 || r.note.length > 2000)
    result.push("桌号/分组/备注过长");
  if (r.review) result.push("原文含复杂注释或多余字段，请核对并确认");
  return result;
}
