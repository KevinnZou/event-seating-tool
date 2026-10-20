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
      path: `docs/design/v01/workspace-${testInfo.project.name}.png`,
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
      path: `docs/design/v01/home-${testInfo.project.name}.png`,
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

test("写入空间不足时明确提示且不生成半个活动", async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === "events")
        throw new DOMException("测试存储已满", "QuotaExceededError");
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "新建活动", exact: true }).click();
  await page.getByLabel("活动名称").fill("虚构空间不足测试");
  await page.getByRole("button", { name: "保存活动", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("存储空间不足");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "从一场活动开始" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "虚构空间不足测试" }),
  ).toHaveCount(0);
});

test("键盘跳转、弹窗焦点约束与Escape返回入口", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "从一场活动开始" }),
  ).toBeVisible();
  // Safari uses Option+Tab to include links when full keyboard access is off.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const open = page.getByRole("button", { name: "新建活动", exact: true });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("活动名称")).toBeFocused();
  // Shift+Tab from the first form field reaches the dialog close button, then wraps within it.
  await page.keyboard.press(
    browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab",
  );
  await expect(
    page.getByRole("button", { name: "关闭", exact: true }),
  ).toBeFocused();
  await page.keyboard.press(
    browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab",
  );
  await expect(
    page.getByRole("button", { name: "保存活动", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(open).toBeFocused();
});

test("帮助页隐私说明与匿名草稿不自动附加名单", async ({ page }, testInfo) => {
  const { readFile } = await import("node:fs/promises");
  await page.goto("/");
  await page.getByRole("link", { name: "帮助与隐私", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "使用帮助与隐私" }),
  ).toBeVisible();
  await page.getByLabel("问题或建议").fill("虚构反馈：希望菜单更清楚");
  await page.getByLabel("我已确认不含真实名单、联系方式或其他私人信息").check();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载匿名反馈草稿" }).click();
  const file = testInfo.outputPath("fictional-feedback.txt");
  await (await pending).saveAs(file);
  const content = await readFile(file, "utf8");
  expect(content).toContain("希望菜单更清楚");
  expect(content).not.toContain("示例小禾一家");
  await expect(page.getByRole("status")).toContainText("未向任何人发送");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v01/help-${testInfo.project.name}.png`,
      fullPage: true,
    });
});
