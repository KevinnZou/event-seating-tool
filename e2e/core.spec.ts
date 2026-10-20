import { test, expect } from "@playwright/test";
test("M1 虚构数据完整流程、活动隔离、刷新与无拖拽移动", async ({
  page,
}, testInfo) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "从一场活动开始" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await expect(
    page.getByRole("heading", { name: "虚构演示婚宴" }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("3");
  const family = page.getByLabel("安排 示例小禾一家 的桌位");
  await family.selectOption({ label: "03 桌" });
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.reload();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await expect(family).not.toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/workspace-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "新增宾客组" }).click();
  await page.getByLabel("名称 / 家庭或团队").fill("虚构七人组");
  await page.getByLabel("人数", { exact: true }).fill("7");
  await page.getByRole("button", { name: "保存宾客组" }).click();
  await page
    .getByLabel("安排 虚构七人组 的桌位")
    .selectOption({ label: "03 桌" });
  await expect(page.getByRole("alert")).toContainText("超出 1 席");
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByRole("link", { name: "← 返回本地活动" }).click();
  await page.getByRole("button", { name: "新建活动", exact: true }).click();
  await page.getByLabel("活动名称").fill("虚构第二活动");
  await page.getByLabel("活动类型").selectOption("annual-party");
  await page.getByRole("button", { name: "保存活动" }).click();
  await expect(
    page.getByRole("heading", { name: "虚构第二活动" }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("0");
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("0");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "虚构第二活动" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← 返回本地活动" }).click();
  await expect(
    page.getByRole("heading", { name: "虚构演示婚宴" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "虚构第二活动" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/home-${testInfo.project.name}.png`,
      fullPage: true,
    });
  expect(errors).toEqual([]);
});
test("本机不存在活动给出说明", async ({ page }) => {
  await page.goto("/#/events/missing");
  await expect(
    page.getByRole("heading", { name: "本机无此活动" }),
  ).toBeVisible();
});
test("存储不可用明确失败且不显示已保存", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("测试禁用存储", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("存储");
  await expect(page.getByText("已保存到本机", { exact: true })).toHaveCount(0);
});
