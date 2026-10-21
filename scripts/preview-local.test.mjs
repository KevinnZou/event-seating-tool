/* global fetch */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const script = fileURLToPath(new URL("./preview-local.mjs", import.meta.url));
test(
  "构建替换源目录和修改测试worker不影响正在运行的预览",
  { timeout: 15000 },
  async (t) => {
    const fixture = await mkdtemp(join(tmpdir(), "seating-preview-test-"));
    let child;
    t.after(async () => {
      if (child && child.exitCode === null) {
        const closed = once(child, "exit");
        child.kill("SIGTERM");
        await closed;
      }
      await rm(fixture, { recursive: true, force: true });
    });
    const dist = join(fixture, "dist");
    await mkdir(join(dist, "assets"), { recursive: true });
    await writeFile(join(dist, "index.html"), "<h1>fictional-release-one</h1>");
    await writeFile(
      join(dist, "assets", "old.js"),
      "/* fictional old asset */",
    );
    await writeFile(join(dist, "sw.js"), "/* fictional worker one */");
    child = spawn(process.execPath, [script, "--port", "0"], { cwd: fixture });
    const origin = await new Promise((resolve, reject) => {
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const url = output.match(
          /http:\/\/127\.0\.0\.1:\d+\/event-seating-tool\//,
        )?.[0];
        if (url) resolve(url);
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`preview exited: ${code}`)),
      );
    });
    assert.match(await (await fetch(origin)).text(), /fictional-release-one/);
    await rm(dist, { recursive: true });
    await mkdir(dist);
    await writeFile(join(dist, "index.html"), "<h1>fictional-release-two</h1>");
    await writeFile(join(dist, "sw.js"), "/* fictional test update */");
    assert.match(await (await fetch(origin)).text(), /fictional-release-one/);
    const asset = await fetch(new URL("assets/old.js", origin));
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), "/* fictional old asset */");
    assert.equal(
      await (await fetch(new URL("sw.js", origin))).text(),
      "/* fictional worker one */",
    );
  },
);
