import { it, expect } from "vitest";
import {
  parseText,
  parseCsv,
  guessMapping,
  mapRows,
  rowErrors,
} from "../features/import/parsers";
import { planImport } from "../features/import/importService";
import { fixture } from "./fixtures/snapshot";
import { checkZip } from "../features/import/files";
it("中文括号、家庭人数、桌标题、注释不猜礼份人数", () => {
  const rows = parseText(
    "03号桌：虚构甲、虚构乙夫妻（2）\n虚构丙一家(4)\n虚构丁{礼3；备注}\n虚构戊,3,朋友\n虚构未知一家",
  );
  expect(rows.map((r) => r.size)).toEqual(["1", "2", "4", "1", "3", ""]);
  expect(rows[1].table).toBe("03");
  expect(rows[3].review).toBe(true);
  expect(rowErrors(rows[5])).not.toHaveLength(0);
});
it("CSV引号、BOM、换行、映射与错误行不丢弃", () => {
  const cells = parseCsv(
    '\uFEFF名称,人数,备注\n"虚构,甲",4,"第一行\n第二行"\n虚构乙,0,错误',
  );
  const rows = mapRows(cells, guessMapping(cells[0]));
  expect(rows).toHaveLength(2);
  expect(rows[0].name).toBe("虚构,甲");
  expect(rows[0].note).toContain("\n");
  expect(rowErrors(rows[1])).toContain("人数需1–999整数");
});
it("未知桌、锁定与超员阻止，重复姓名全部新增", () => {
  const s = fixture();
  const rows = parseText("虚构同名\n虚构同名");
  expect(planImport(s, rows, "append", false).guests).toHaveLength(8);
  const unknown = parseText("A1号桌：虚构甲");
  expect(() => planImport(s, unknown, "append", false)).toThrow("未知");
  expect(planImport(s, unknown, "append", true).tables).toHaveLength(4);
  expect(() =>
    planImport(s, parseText("03号桌：虚构团队(8)"), "append", false),
  ).toThrow("超出");
});
it("无效ZIP与过大解压数据拒绝", () => {
  expect(() => checkZip(new ArrayBuffer(4))).toThrow();
  const bytes = new ArrayBuffer(46),
    d = new DataView(bytes);
  d.setUint32(0, 0x02014b50, true);
  d.setUint32(24, 40 * 1024 * 1024, true);
  expect(() => checkZip(bytes)).toThrow("过大");
});
