import { it, expect } from "vitest";
import { fixture } from "./fixtures/snapshot";
import {
  createCsv,
  createTemplateXlsx,
  templateRows,
  createXlsx,
  escapeSpreadsheetCell,
  guestRows,
  tableRows,
  textReport,
} from "../features/export/reports";
import { safeFilename } from "../lib/download";
import { readWorkbook } from "../features/import/files";
import { parseCsv } from "../features/import/parsers";
it("CSV转义引号换行、BOM与公式，数值不受影响", () => {
  const csv = createCsv([
    ["名称", "人数", "备注"],
    ["=SUM(1,1)", 4, '含"引号"\n新行'],
  ]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  const cells = parseCsv(csv);
  expect(cells[1]).toEqual(["'=SUM(1,1)", "4", '含"引号"\n新行']);
  for (const v of ["=1", "+cmd", "-1", "@x", " \t=1"])
    expect(escapeSpreadsheetCell(v)).toBe(`'${v}`);
});
it("文本和明细不丢家庭/同名/未排与不参加，桌数按记录", () => {
  const s = fixture();
  expect(guestRows(s)).toHaveLength(7);
  expect(tableRows(s)).toHaveLength(4);
  expect(textReport(s)).toContain("示例小禾一家（4人");
  expect(textReport(s, true)).toContain("【偶数桌】");
  expect(textReport(s)).toContain("【不参加（不占席）】");
});
it("XLSX生成可重新读取且公式文本为普通字符串", async () => {
  const s = fixture();
  s.guests[0].displayName = "=危险示例";
  const bytes = await createXlsx(s);
  const rows = await readWorkbook({
    size: bytes.byteLength,
    arrayBuffer: async () => bytes,
  } as File);
  expect(rows).toHaveLength(3);
  expect(rows[0].rows[1][0]).toBe("'=危险示例");
  expect(rows[0].rows[1][1]).toBe("4");
  expect(rows[1].rows).toHaveLength(4);
});
it("文件名过滤控制字符和路径且长名保留扩展名", () => {
  expect(safeFilename("../虚构/活动.json")).not.toContain("/");
  expect(safeFilename("长".repeat(200) + ".json")).toMatch(/\.json$/);
});

it("模板可由导入器读回且示例明确虚构", async () => {
  expect(parseCsv(createCsv(templateRows))[1][1]).toBe("4");
  const bytes = await createTemplateXlsx();
  const workbook = await readWorkbook({
    size: bytes.byteLength,
    arrayBuffer: async () => bytes,
  } as File);
  expect(workbook[0].rows[0]).toEqual([
    "名称",
    "人数",
    "分组",
    "桌号",
    "状态",
    "备注",
  ]);
  expect(workbook[0].rows[1][0]).toContain("虚构");
});
