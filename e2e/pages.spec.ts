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
