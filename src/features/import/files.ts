export const MAX_FILE = 10 * 1024 * 1024;
export function checkZip(bytes: ArrayBuffer) {
  const data = new DataView(bytes);
  let total = 0,
    entries = 0;
  for (let i = 0; i + 46 <= data.byteLength; i++) {
    if (data.getUint32(i, true) !== 0x02014b50) continue;
    entries++;
    total += data.getUint32(i + 24, true);
    if (total > 32 * 1024 * 1024 || entries > 2000)
      throw new Error("工作簿解压后过大，拒绝读取");
    const flags = data.getUint16(i + 8, true);
    if (flags & 1) throw new Error("不支持加密工作簿");
    const nameLength = data.getUint16(i + 28, true),
      extra = data.getUint16(i + 30, true),
      comment = data.getUint16(i + 32, true);
    const name = new TextDecoder().decode(
      new Uint8Array(
        bytes,
        i + 46,
        Math.min(nameLength, data.byteLength - i - 46),
      ),
    );
    if (/vbaProject|externalLinks/i.test(name))
      throw new Error("不支持宏或外部链接工作簿");
    i += 45 + nameLength + extra + comment;
  }
  if (!entries) throw new Error("不是有效XLSX文件");
}
export async function readWorkbook(file: File) {
  if (file.size > MAX_FILE) throw new Error("文件上限10MB");
  const bytes = await file.arrayBuffer();
  checkZip(bytes);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  let cells = 0;
  return workbook.worksheets.map((sheet) => {
    if (sheet.rowCount > 5001 || sheet.columnCount > 100)
      throw new Error("工作表最多5000行、100列");
    const rows: string[][] = [];
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row: string[] = [];
      for (let j = 1; j <= sheet.columnCount; j++) {
        if (++cells > 100000) throw new Error("工作簿单元格超过10万");
        const cell = sheet.getCell(i, j),
          v = cell.value;
        row.push(
          v === null
            ? ""
            : typeof v === "object"
              ? "formula" in v || "sharedFormula" in v
                ? "[公式需人工替换]"
                : cell.text
              : String(v),
        );
      }
      if (row.some((v) => v.trim())) rows.push(row);
    }
    return { name: sheet.name, rows };
  });
}
export async function readCsv(file: File) {
  if (file.size > MAX_FILE) throw new Error("文件上限10MB");
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030", { fatal: true }).decode(bytes);
  }
}
