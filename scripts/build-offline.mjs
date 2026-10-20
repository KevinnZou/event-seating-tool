import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import console from "node:console";
const directory = "dist";
// Only build-produced app shell/resources. No runtime request caching.
const files = [
  "index.html",
  ...(await readdir(join(directory, "assets")))
    .filter((file) => /\.(js|css|woff2?|png|svg)$/.test(file))
    .map((file) => `assets/${file}`),
].sort();
const template = await readFile("scripts/service-worker.js", "utf8");
const hash = createHash("sha256").update(template);
for (const file of files) {
  hash.update(file);
  hash.update(await readFile(join(directory, file)));
}
const manifest = { version: hash.digest("hex").slice(0, 20), files };
const worker = template.replace(
  /\/\* OFFLINE_MANIFEST \*\/\s*\{ version: "development", files: \[\] \}/,
  JSON.stringify(manifest),
);
if (worker === template)
  throw new Error("Offline manifest placeholder missing");
await writeFile(join(directory, "sw.js"), worker);
await writeFile(join(directory, ".nojekyll"), "");
console.log(
  `Offline shell: ${files.length} static resources, release ${manifest.version}`,
);
