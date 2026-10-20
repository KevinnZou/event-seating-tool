import type { Snapshot } from "../../domain/models";
import { calculateEventStats, occupancy } from "../../domain/calculations";
import { layoutOf, TABLE_RADIUS } from "../../domain/geometry";
import { parseSnapshot } from "../../domain/snapshots";
export function escapeXml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
function text(
  x: number,
  y: number,
  value: string,
  size: number,
  anchor = "start",
  color = "#244c41",
) {
  // XML 1.0 forbids these controls; replace visually, never insert executable markup.
  const safe = [...value]
    .map((c) =>
      (c.charCodeAt(0) < 32 && !"\n\r\t".includes(c)) ||
      c.charCodeAt(0) === 0xfffe ||
      c.charCodeAt(0) === 0xffff ||
      (c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff)
        ? "�"
        : c,
    )
    .join("");
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${escapeXml(safe)}</text>`;
}
export function planSvg(input: Snapshot) {
  const s = parseSnapshot(input),
    { venue, tables } = layoutOf(s),
    stats = calculateEventStats(s);
  const width = venue.width;
  const wrap = (value: string, length: number) =>
    Array.from({ length: Math.ceil([...value].length / length) }, (_, i) =>
      [...value].slice(i * length, (i + 1) * length).join(""),
    );
  const heading = wrap(
    s.event.name,
    Math.max(10, Math.floor((width - 56) / 23)),
  );
  const summary = wrap(
    `计划 ${stats.plannedCount} 人 · 已排 ${stats.assignedCount} 人 · 未排 ${stats.unassignedCount} 人 · 不参加 ${stats.declinedCount} 人 · ${stats.tableCount} 桌`,
    Math.max(15, Math.floor((width - 56) / 15)),
  );
  const footer = wrap(
    "场地示意 · 不含宾客姓名 · 完整名单请另附文字/表格报表",
    Math.max(15, Math.floor((width - 56) / 12)),
  );
  const headerHeight = heading.length * 28 + summary.length * 20 + 40;
  const height = venue.height + headerHeight + footer.length * 16 + 20;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="场地圆桌分配图"><rect width="100%" height="100%" fill="#ffffff"/><g font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif">`,
    ...heading.map((row, i) => text(28, 34 + i * 28, row, 23)),
    ...summary.map((row, i) =>
      text(28, 48 + heading.length * 28 + i * 20, row, 15),
    ),
  ];
  parts.push(
    `<g transform="translate(0 ${headerHeight})"><rect x="1" y="1" width="${width - 2}" height="${venue.height - 2}" fill="#fbfcfa" stroke="#afc5bb"/>`,
  );
  for (const area of venue.areas) {
    parts.push(
      `<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" rx="5" fill="${area.kind === "aisle" ? "#f3dfb3" : area.kind === "entrance" ? "#efe8d8" : "#dce8df"}" stroke="#82988e"/>`,
    );
    const max = Math.max(2, Math.floor(area.width / 18));
    const rows = Array.from(
      { length: Math.ceil([...area.label].length / max) },
      (_, i) => [...area.label].slice(i * max, (i + 1) * max).join(""),
    );
    rows.forEach((row, i) =>
      parts.push(
        text(
          area.x + area.width / 2,
          area.y + area.height / 2 + (i - (rows.length - 1) / 2) * 22,
          row,
          18,
          "middle",
        ),
      ),
    );
  }
  for (const table of tables) {
    const { x, y } = table.position;
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${TABLE_RADIUS}" fill="${table.locked ? "#f4efe5" : "#edf5ef"}" stroke="#5f9180" stroke-width="2"/>`,
    );
    const chars = [...table.label],
      fontSize =
        chars.length <= 4
          ? 22
          : Math.max(8, Math.min(14, 72 / Math.min(chars.length, 10)));
    const rows = Array.from({ length: Math.ceil(chars.length / 10) }, (_, i) =>
      chars.slice(i * 10, (i + 1) * 10).join(""),
    );
    rows.forEach((row, i) =>
      parts.push(
        text(
          x,
          y - 12 + (i - (rows.length - 1) / 2) * (fontSize + 1),
          row,
          fontSize,
          "middle",
        ),
      ),
    );
    parts.push(
      text(
        x,
        y + 19,
        `${occupancy(s, table.id)} / ${table.capacity} 席`,
        12,
        "middle",
      ),
    );
    if (table.locked)
      parts.push(text(x, y + 34, "锁定", 9, "middle", "#88744d"));
  }
  parts.push(
    "</g>",
    ...footer.map((row, i) =>
      text(
        28,
        headerHeight + venue.height + 18 + i * 16,
        row,
        12,
        "start",
        "#65777d",
      ),
    ),
    "</g></svg>",
  );
  return { svg: parts.join(""), width, height };
}
export function pngDimensions(width: number, height: number) {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0))
    throw new Error("导出尺寸无效");
  const scale = Math.min(
    2,
    4096 / Math.max(width, height),
    Math.sqrt(16_000_000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}
export async function planPng(s: Snapshot) {
  const { svg, width, height } = planSvg(s),
    dimensions = pngDimensions(width, height);
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("场地图图像生成失败，请改用SVG下载"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持PNG生成，请下载SVG");
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG生成失败，请下载SVG")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
