import Papa from "papaparse";
import type { Snapshot } from "../../domain/models";
import { attendanceLabels } from "../../domain/models";
import {
  occupancy,
  calculateEventStats,
  tableParity,
} from "../../domain/calculations";
export function escapeSpreadsheetCell(value: string) {
  const first = [...value].find((c) => c.charCodeAt(0) > 32 && !/\s/.test(c));
  return first && "=+-@".includes(first) ? `'${value}` : value;
}
export function guestRows(
  s: Snapshot,
  unassignedOnly = false,
): (string | number)[][] {
  return [
    ["名称", "人数", "分组", "桌号", "状态", "备注"],
    ...s.guests
      .filter(
        (g) => !unassignedOnly || (!g.tableId && g.attendance !== "declined"),
      )
      .map((g) => [
        g.displayName,
        g.size,
        g.category ?? "",
        s.tables.find((t) => t.id === g.tableId)?.label ?? "",
        attendanceLabels[g.attendance],
        g.note ?? "",
      ]),
  ];
}
export function tableRows(s: Snapshot): (string | number)[][] {
  return [
    ["桌号", "已占席位", "容量", "余席", "锁定", "备注"],
    ...s.tables.map((t) => [
      t.label,
      occupancy(s, t.id),
      t.capacity,
      t.capacity - occupancy(s, t.id),
      t.locked ? "是" : "否",
      t.note ?? "",
    ]),
  ];
}
export function createCsv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      rows.map((row) =>
        row.map((v) => (typeof v === "string" ? escapeSpreadsheetCell(v) : v)),
      ),
      { newline: "\r\n" },
    )
  );
}
export function textReport(s: Snapshot, parity = false) {
  const stats = calculateEventStats(s);
  const lines = [
    s.event.name,
    s.event.date ?? "",
    `录入 ${stats.totalRecordedCount} 人 · 计划 ${stats.plannedCount} 人 · 已排 ${stats.assignedCount} 人 · 未排 ${stats.unassignedCount} 人 · 余席 ${stats.freeSeats}`,
    `待定 ${stats.tentativeCount} 人 · 不参加 ${stats.declinedCount} 人`,
    "",
  ];
  const tableLines = (tables: Snapshot["tables"]) =>
    tables.flatMap((t) => [
      `${t.label}号桌（${occupancy(s, t.id)}/${t.capacity}席${t.locked ? "，已锁定" : ""}）`,
      ...s.guests
        .filter((g) => g.tableId === t.id)
        .map(
          (g) =>
            `${g.displayName}（${g.size}人，${attendanceLabels[g.attendance]}）${g.note ? ` · ${g.note}` : ""}`,
        ),
      "",
    ]);
  if (parity) {
    lines.push(
      "【奇数桌】",
      ...tableLines(s.tables.filter((t) => tableParity(t.label) === "odd")),
      "【偶数桌】",
      ...tableLines(s.tables.filter((t) => tableParity(t.label) === "even")),
      "【自定义桌】",
      ...tableLines(s.tables.filter((t) => tableParity(t.label) === "custom")),
    );
  } else lines.push(...tableLines(s.tables));
  lines.push(
    "【未安排】",
    ...s.guests
      .filter((g) => !g.tableId && g.attendance !== "declined")
      .map(
        (g) =>
          `${g.displayName}（${g.size}人，${attendanceLabels[g.attendance]}）${g.note ? ` · ${g.note}` : ""}`,
      ),
    "",
    "【不参加（不占席）】",
    ...s.guests
      .filter((g) => g.attendance === "declined")
      .map((g) => `${g.displayName}（${g.size}人）`),
  );
  return lines.join("\n");
}
export async function createXlsx(s: Snapshot) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const stats = calculateEventStats(s);
  const metrics: (string | number)[][] = [
    ["统计项", "人数 / 席位"],
    ["录入人数", stats.totalRecordedCount],
    ["计划出席", stats.plannedCount],
    ["已安排", stats.assignedCount],
    ["未安排", stats.unassignedCount],
    ["待定", stats.tentativeCount],
    ["不参加", stats.declinedCount],
    ["总容量", stats.capacity],
    ["余席", stats.freeSeats],
  ];
  for (const [name, rows] of [
    ["宾客明细", guestRows(s)],
    ["桌位汇总", tableRows(s)],
    ["活动统计", metrics],
  ] as const) {
    const sheet = workbook.addWorksheet(name);
    for (const row of rows)
      sheet.addRow(
        row.map((v) => (typeof v === "string" ? escapeSpreadsheetCell(v) : v)),
      );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF14665F" },
    };
    sheet.columns.forEach((column, i) => {
      column.width = i === 0 ? 28 : i === 5 ? 44 : 18;
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length, column: rows[0].length },
    };
    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
