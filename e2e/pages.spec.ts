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
