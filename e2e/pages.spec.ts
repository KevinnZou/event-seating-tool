import { openExtra } from "./interactions.js";
import { test, expect } from "@playwright/test";
test("生产产物子路径和Hash深链接刷新可用", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "从一场活动开始" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
  expect(page.url()).toContain("/event-seating-tool/#/events/");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "虚构演示婚宴" }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("3");
});

test("生产版离线重开保留安排，尚未访问的导出和Excel也可离线使用", async ({
  browserName,
}, testInfo) => {
  const { chromium, webkit } = await import("@playwright/test");
  const engine = browserName === "webkit" ? webkit : chromium;
  const options = {
    executablePath:
      browserName === "chromium"
        ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        : undefined,
  };
  const profile = testInfo.outputPath("offline-profile");
  let context = await engine.launchPersistentContext(profile, options);
  let page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  let url: string;
  try {
    await page.goto("http://127.0.0.1:4175/event-seating-tool/");
    await expect(
      page.getByRole("status").filter({ hasText: "离线资源已就绪" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "试用虚构演示" }).click();
    await page
      .getByLabel("安排 示例小禾一家 的桌位")
      .selectOption({ label: "03 桌" });
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
    await page.getByRole("button", { name: "场地平面图", exact: true }).click();
    await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
    await page.getByLabel("选中项X坐标").fill("500");
    await page.getByLabel("选中项Y坐标").fill("400");
    await page.getByRole("button", { name: "保存位置", exact: true }).click();
    await openExtra(page, "命名方案与差异");
    await page.getByLabel("新方案名称").fill("虚构离线方案");
    await page.getByRole("button", { name: "保存当前为命名方案" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
      "命名方案已保存",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "完成", exact: true })
      .click();
    url = page.url();
    await page.evaluate(async () => {
      const keys = await caches.keys();
      const resources = (
        await Promise.all(
          keys.map(async (key) =>
            (await (await caches.open(key)).keys()).map(
              (request) => request.url,
            ),
          ),
        )
      ).flat();
      if (
        resources.some(
          (resource) => !/\/(index\.html|assets\/[^/]+)$/.test(resource),
        )
      )
        throw new Error("缓存含非静态资源");
    });
  } finally {
    await context.close();
  }
  context = await engine.launchPersistentContext(profile, {
    ...options,
    offline: true,
  });
  page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await context.setOffline(true);
  try {
    await page.goto(url);
    await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
    // Browser online hints vary across persistent-context launches; prove the network is unavailable.
    expect(
      await page.evaluate(async () => {
        try {
          await fetch(`network-check-${crypto.randomUUID()}`);
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "场地平面图", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "名单与桌位", exact: true }).click();
    await page
      .getByLabel("安排 示例小禾一家 的桌位")
      .selectOption({ label: "66 桌" });
    await page.getByRole("link", { name: "导出交付", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载Excel工作簿" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
    await page
      .getByRole("button", { name: "完整备份与恢复", exact: true })
      .click();
    const backup = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "下载本活动完整备份", exact: true })
      .click();
    expect((await backup).suggestedFilename()).toMatch(/\.json$/);
    await page
      .getByRole("button", { name: "关闭备份与恢复", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "导出交付", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "← 返回排桌工作区" }).click();
    await page.getByRole("button", { name: "场地平面图", exact: true }).click();
    await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
    await expect(page.getByLabel("选中项X坐标")).toHaveValue("500");
    await openExtra(page, "命名方案与差异");
    await expect(page.getByLabel("重命名方案 虚构离线方案")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "完成", exact: true })
      .click();
    await page.getByRole("link", { name: "导出场地图", exact: true }).click();
    const pngWait = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载PNG场地图" }).click();
    const png = await pngWait;
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    await png.saveAs(testInfo.outputPath(`offline-plan-${browserName}.png`));
  } finally {
    await context.close();
  }
});

test("应用更新先等待确认，刷新后本机活动不丢失", async ({ page }) => {
  const { readFile, writeFile } = await import("node:fs/promises");
  const original = await readFile("dist/sw.js", "utf8");
  try {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("./");
    await expect(
      page.getByRole("status").filter({ hasText: "离线资源已就绪" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "试用虚构演示" }).click();
    await page
      .getByLabel("安排 示例小禾一家 的桌位")
      .selectOption({ label: "03 桌" });
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
    const url = page.url();
    await writeFile(
      "dist/sw.js",
      original.replace(/"version":"[^"]+"/, '"version":"acceptance-update"'),
    );
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    const refresh = page.getByRole("button", {
      name: "新版本就绪，备份后刷新",
    });
    await expect(refresh).toBeVisible();
    expect(page.url()).toBe(url);
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeEnabled();
    await Promise.all([page.waitForEvent("load"), refresh.click()]);
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
    await expect(
      page.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
    await expect(refresh).not.toBeVisible();
  } finally {
    await writeFile("dist/sw.js", original);
  }
});

test("数据库升级被其他标签占用时说明原因，释放后自动恢复且保留活动", async ({
  page,
  context,
}) => {
  await page.route("**/holder.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>虚构升级阻塞测试</title>",
    }),
  );
  await page.goto("./holder.html");
  const eventId = "00000000-0000-4000-8000-000000000041";
  await page.evaluate(async (id) => {
    const request = indexedDB.open("event-seating-tool-local-v1", 30);
    request.onupgradeneeded = () => {
      const db = request.result;
      const stores = {
        events: ["updatedAt"],
        guests: ["eventId", "tableId", "[eventId+tableId]"],
        seatingTables: ["eventId", "[eventId+orderIndex]"],
        checkpoints: ["eventId", "createdAt"],
        localMeta: [],
      };
      for (const [name, indexes] of Object.entries(stores)) {
        const store = db.createObjectStore(name, {
          keyPath: name === "localMeta" ? "key" : "id",
        });
        for (const key of indexes)
          store.createIndex(
            key,
            key.startsWith("[") ? key.slice(1, -1).split("+") : key,
          );
      }
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.onversionchange = () => {}; // Deliberately hold an old tab open to reproduce a blocked upgrade.
    (window as unknown as { heldDB: IDBDatabase }).heldDB = db;
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").put({
      id,
      name: "虚构升级保留活动",
      type: "banquet",
      defaultCapacity: 10,
      overCapacityPolicy: "block",
      schemaVersion: 1,
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, eventId);
  const app = await context.newPage();
  await app.goto("./");
  await expect(
    app.getByRole("heading", { name: "正在等待其他标签页释放数据" }),
  ).toBeVisible();
  await expect(
    app.getByRole("link", { name: "修复页面加载", exact: true }),
  ).toBeVisible();
  if (process.env.CAPTURE_RECOVERY)
    await app.screenshot({
      path: `output/playwright/recovery/blocked-${test.info().project.name}.png`,
    });
  await page.evaluate(() =>
    (window as unknown as { heldDB: IDBDatabase }).heldDB.close(),
  );
  await expect(
    app.getByRole("heading", { name: "虚构升级保留活动", exact: true }),
  ).toBeVisible();
  await app.reload();
  await expect(
    app.getByRole("heading", { name: "虚构升级保留活动", exact: true }),
  ).toBeVisible();
});

test("生产版连续刷新与独立加载修复入口均保留宾客安排", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "试用虚构演示", exact: true }).click();
  await page
    .getByLabel("安排 示例小禾一家 的桌位")
    .selectOption({ label: "03 桌" });
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  const url = page.url();
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  }
  await page.goto("./recover.html");
  await expect(
    page.getByRole("heading", { name: "修复页面加载", exact: true }),
  ).toBeVisible();
  if (process.env.CAPTURE_RECOVERY)
    await page.screenshot({
      path: `output/playwright/recovery/entry-${test.info().project.name}.png`,
    });
  await page
    .getByRole("button", { name: "更新应用并重新打开", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "本地活动", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.reload();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
});

test("已保存但未下载备份的名单刷新不触发离页拦截", async ({
  page,
  context,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.accept(); // Record unexpected dialogs so the regression fails instead of hanging.
  });
  await page.goto("./");
  await page.getByRole("button", { name: "试用虚构演示", exact: true }).click();
  await page
    .getByLabel("安排 示例小禾一家 的桌位")
    .selectOption({ label: "03 桌" });
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await expect(page.getByText("尚未备份", { exact: false })).toBeVisible();
  const url = page.url();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "场地平面图", exact: true }).click();
    await page.reload();
    await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
    await expect(
      page.getByRole("button", { name: "场地平面图", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("尚未备份", { exact: false })).toBeVisible();
    expect(dialogs, "持久化完成后不能因未下载外部备份拦截刷新").toEqual([]);
  }
  const second = await context.newPage();
  second.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.accept();
  });
  await second.goto(url);
  await expect(second.getByTestId("stat-已安排人数")).toHaveText("4");
  await second.reload();
  await expect(second.getByTestId("stat-已安排人数")).toHaveText("4");
  expect(dialogs).toEqual([]);
});
