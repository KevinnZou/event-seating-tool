import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import process from "node:process";
import console from "node:console";
import { preview } from "vite";

const { values } = parseArgs({
  options: {
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string", default: "4176" },
    base: { type: "string", default: "/event-seating-tool/" },
  },
});
// Serve one complete release. Rebuilding dist must never replace a live tab's chunks.
await readFile(resolve("dist/index.html"));
const snapshot = await mkdtemp(join(tmpdir(), "event-seating-preview-"));
await cp(resolve("dist"), snapshot, { recursive: true });
let server;
try {
  server = await preview({
    configFile: false,
    base: values.base,
    build: { outDir: snapshot },
    preview: { host: values.host, port: Number(values.port), strictPort: true },
  });
  server.printUrls();
  process.send?.({ type: "preview-ready", url: server.resolvedUrls.local[0] });
  console.log(
    "固定构建快照：后续 build 不影响本次预览；更新预览需重启此命令。",
  );
} catch (error) {
  await rm(snapshot, { recursive: true, force: true });
  throw error;
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await new Promise((done) => server.httpServer.close(done));
    await rm(snapshot, { recursive: true, force: true });
    process.exit(0);
  });
}
