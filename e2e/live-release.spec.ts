import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// Explicit opt-in public-site verification. All writes stay inside disposable browser storage.
test("公网发布：虚构名单、名单总览、换桌刷新、备份和断网重开", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const writes: string[] = [],
    errors: string[] = [],
    dialogs: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()))
      writes.push(`${request.method()} ${request.url()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.accept();
  });
  expect((await page.goto("./"))?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "从一场活动开始", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "离线资源已就绪" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "试用虚构演示", exact: true }).click();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
  await page
    .getByLabel("安排 示例小禾一家 的桌位")
    .selectOption({ label: "03 桌" });
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByRole("button", { name: "场地平面图", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "显示宾客名单", exact: true })
    .check();
  await expect(
    page.getByRole("region", { name: "03桌宾客名单", exact: true }),
  ).toContainText("示例小禾一家×4");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "显示宾客名单", exact: true }),
  ).toBeChecked();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await page
    .getByLabel("平面图移动 示例小禾一家")
    .selectOption({ label: "66 桌 · 余 10 席" });
  const roster = page.getByRole("region", {
    name: "66桌宾客名单",
    exact: true,
  });
  await expect(roster).toContainText("示例小禾一家×4");
  await expect(
    page.getByRole("region", { name: "03桌宾客名单", exact: true }),
  ).toHaveText("暂无宾客");
  await page
    .getByRole("button", { name: "完整备份与恢复", exact: true })
    .click();
  const waiting = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载本活动完整备份", exact: true })
    .click();
  const path = testInfo.outputPath("fictional-public-site-backup.json");
  await (await waiting).saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.events).toHaveLength(1);
  expect(backup.tables).toHaveLength(3);
  expect(backup.guestGroups).toHaveLength(6);
  const family = backup.guestGroups.find(
    (guest: { displayName: string }) => guest.displayName === "示例小禾一家",
  );
  expect(family.size).toBe(4);
  expect(family.tableId).toBe(
    backup.tables.find((table: { label: string }) => table.label === "66").id,
  );
  await page
    .getByRole("button", { name: "关闭备份与恢复", exact: true })
    .click();
  try {
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
    await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
    await expect(roster).toContainText("示例小禾一家×4");
  } finally {
    await context.setOffline(false);
  }
  await roster.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `output/playwright/release/${testInfo.project.name}.png`,
  });
  const clean = await browser.newContext();
  try {
    const fresh = await clean.newPage();
    await fresh.goto("https://kevinnzou.github.io/event-seating-tool/");
    await expect(
      fresh.getByRole("heading", { name: "从一场活动开始", exact: true }),
    ).toBeVisible();
  } finally {
    await clean.close();
  }
  expect(writes, "名单操作不应发出网络写请求").toEqual([]);
  expect(errors).toEqual([]);
  expect(dialogs, "已保存的名单刷新不应出现原生离页提示").toEqual([]);
});
