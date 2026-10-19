import { test, expect } from "@playwright/test";
test("导入纠错、同名保留、搜索、批量移桌与撤销重做", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await page.getByRole("button", { name: "导入名单", exact: true }).click();
  await page
    .getByLabel("粘贴文本")
    .fill("虚构导入一家(4)\n虚构同名\n虚构同名\n虚构待核一家");
  await page.getByRole("button", { name: "生成预览" }).click();
  await expect(
    page.getByRole("button", { name: "核对完成，下一步" }),
  ).toBeDisabled();
  await page.getByLabel("第4行人数").fill("2");
  await page.getByRole("button", { name: "核对完成，下一步" }).click();
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已新增 4 组");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("19");
  await page.getByLabel("搜索宾客").fill("tongming");
  await expect(
    page.getByRole("checkbox", { name: "选择 虚构同名", exact: true }),
  ).toHaveCount(2);
  await page.getByLabel("搜索宾客").fill("daoru");
  await page
    .getByRole("checkbox", { name: "选择 虚构导入一家", exact: true })
    .check();
  await page.getByLabel("批量目标桌").selectOption({ label: "01 桌" });
  await page.getByRole("button", { name: "移动所选", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("0");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByLabel("搜索宾客").fill("");
  await page.getByRole("button", { name: "排桌工作台", exact: true }).click();
  await page
    .getByLabel("工作台安排 虚构导入一家")
    .selectOption({ label: "03 桌" });
  await expect(
    page.getByRole("heading", { name: "03 桌", exact: true }).locator(".."),
  ).toContainText("4 / 10");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
