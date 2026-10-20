import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";
import console from "node:console";
const forbidden = [
  "defaultTables.json",
  "defaultStaging.json",
  "wedding-seating-planner",
  "qrcode",
];
const findings = [];
let checked = 0;
function scan(folder) {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (
      ![".ts", ".tsx", ".js", ".json", ".html", ".css"].includes(extname(path))
    )
      continue;
    checked++;
    const text = readFileSync(path, "utf8");
    for (const value of forbidden)
      if (text.includes(value))
        findings.push(`${path}: 禁止的旧项目引用 ${value}`);
    if (
      folder.startsWith("src") &&
      /console\.(log|debug|info)\s*\(|dangerouslySetInnerHTML|localStorage\.setItem|XMLHttpRequest/.test(
        text,
      )
    )
      findings.push(`${path}: 需要审查的日志/HTML/网络/持久化调用`);
  }
}
if (!existsSync("dist/index.html"))
  throw new Error("请先运行 npm run build，再审查构建产物");
for (const folder of ["src", "public", "dist"]) scan(folder);
const history = execFileSync(
  "git",
  ["log", "--all", "--name-only", "--pretty=format:"],
  { encoding: "utf8" },
);
for (const name of ["defaultTables.json", "defaultStaging.json"])
  if (history.includes(name)) findings.push(`Git历史含禁止的数据文件 ${name}`);
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `通过：审查 ${checked} 个源码/静态产物文件及Git文件历史，未发现禁止的旧项目引用或应用敏感调用。`,
  );
console.log(
  "边界：此检查不识别任意真实姓名；隐私保障同时依赖演示数据独立虚构、未读取旧名单的来源审查。",
);
