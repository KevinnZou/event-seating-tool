// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { it, expect, vi } from "vitest";
const scope = "https://example.test/event-seating-tool/";
const name = `event-seating-static:${scope}:test-release`;
type WorkerEvent = {
  request?: { url: string; method: string; mode: string };
  data?: { type: string };
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
};
function worker(failInstall = false) {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const data = new Map<string, Map<string, Response>>();
  const cache = async (key: string) => {
    if (!data.has(key)) data.set(key, new Map());
    const records = data.get(key)!;
    return {
      match: async (url: string) => records.get(url),
      addAll: async (requests: Request[]) => {
        if (failInstall) throw new Error("offline download failed");
        requests.forEach((request) =>
          records.set(request.url, new Response("static")),
        );
      },
    };
  };
  const fetch = vi.fn(async () => new Response("network"));
  const claim = vi.fn();
  const skipWaiting = vi.fn();
  const source = readFileSync(
    new URL("../../scripts/service-worker.js", import.meta.url),
    "utf8",
  ).replace(
    '{ version: "development", files: [] }',
    JSON.stringify({
      version: "test-release",
      files: ["index.html", "assets/app.js"],
    }),
  );
  runInNewContext(source, {
    self: {
      registration: { scope },
      clients: { claim },
      skipWaiting,
      addEventListener: (key: string, handler: (event: WorkerEvent) => void) =>
        handlers.set(key, handler),
    },
    caches: {
      open: cache,
      keys: async () => [...data.keys()],
      delete: async (key: string) => data.delete(key),
    },
    fetch,
    URL,
    Request,
  });
  function lifecycle(type: string) {
    let result: Promise<unknown> | undefined;
    handlers.get(type)!({
      waitUntil: (promise) => {
        result = promise;
      },
    });
    return result!;
  }
  function request(url: string, method = "GET", mode = "cors") {
    let result: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: { url, method, mode },
      respondWith: (promise) => {
        result = promise;
      },
    });
    return result;
  }
  return { data, request, lifecycle, handlers, fetch, claim, skipWaiting };
}
it("离线缓存只写构建清单，Hash导航使用应用壳，不缓存动态业务请求", async () => {
  const w = worker();
  await w.lifecycle("install");
  expect([...w.data.get(name)!.keys()]).toEqual([
    `${scope}index.html`,
    `${scope}assets/app.js`,
  ]);
  expect(
    await (
      await w.request(`${scope}#/events/fictional`, "GET", "navigate")
    )?.text(),
  ).toBe("static");
  expect(w.request(`${scope}private-name.json`)).toBeUndefined();
  expect(w.request(`${scope}assets/app.js`, "POST")).toBeUndefined();
  expect(w.request("https://other.test/assets/app.js")).toBeUndefined();
  expect(
    w.request("https://example.test/other-project/", "GET", "navigate"),
  ).toBeUndefined();
  expect(w.fetch).not.toHaveBeenCalled();
});
it("预缓存失败清理不完整缓存，不激活或清理旧版数据", async () => {
  const w = worker(true);
  await expect(w.lifecycle("install")).rejects.toThrow(
    "offline download failed",
  );
  expect(w.data.has(name)).toBe(false);
  expect(w.skipWaiting).not.toHaveBeenCalled();
});
it("更新保留前一版，清理仅作用于自身路径，旧标签的chunk仍可读取", async () => {
  const w = worker();
  const prefix = `event-seating-static:${scope}:`;
  w.data.set(`${prefix}oldest`, new Map());
  w.data.set(
    `${prefix}previous`,
    new Map([[`${scope}assets/old.js`, new Response("previous")]]),
  );
  w.data.set("foreign-app-cache", new Map());
  await w.lifecycle("install");
  await w.lifecycle("activate");
  expect(w.data.has(`${prefix}oldest`)).toBe(false);
  expect(w.data.has(`${prefix}previous`)).toBe(true);
  expect(w.data.has("foreign-app-cache")).toBe(true);
  expect(await (await w.request(`${scope}assets/old.js`))?.text()).toBe(
    "previous",
  );
  expect(w.claim).toHaveBeenCalledOnce();
  expect(w.skipWaiting).not.toHaveBeenCalled();
  w.handlers.get("message")!({ data: { type: "ACTIVATE_UPDATE" } });
  expect(w.skipWaiting).toHaveBeenCalledOnce();
});
