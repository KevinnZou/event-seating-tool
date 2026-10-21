import { test, expect } from "@playwright/test";
test("首次使用：不打开高级工具，仅循下一步完成创建、导入、加桌、排桌和导出", async ({
  page,
}, testInfo) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "新建活动", exact: true }).click();
  await page.getByLabel("活动名称", { exact: true }).fill("虚构首次使用婚宴");
  await page.getByRole("button", { name: "保存活动", exact: true }).click();
  const guide = page.getByRole("region", { name: "排桌流程与下一步" });
  await expect(
    guide.getByRole("heading", { name: "先把宾客名单加进来" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "命名方案与差异", exact: true }),
  ).toBeHidden();
  if (process.env.CAPTURE_ONBOARDING)
    await page.screenshot({
      path: `output/playwright/onboarding/start-${testInfo.project.name}.png`,
    });
  await guide
    .getByRole("button", { name: "导入第一份名单", exact: true })
    .click();
  await page.getByLabel("粘贴文本").fill("虚构入门家庭(4)\n虚构入门夫妻(2)");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page
    .getByRole("button", { name: "核对完成，下一步", exact: true })
    .click();
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "已新增 2 组",
  );
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "名单已录入，接下来添加圆桌" }),
  ).toBeVisible();
  await expect(page.getByLabel("批量目标桌")).toHaveCount(0);
  await expect(page.getByLabel("出席筛选")).toBeHidden();
  await guide
    .getByRole("button", { name: "添加第一张圆桌", exact: true })
    .click();
  await page.getByLabel("展示桌号", { exact: true }).fill("01");
  await page.getByRole("button", { name: "保存桌位", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "还有 6 人待安排" }),
  ).toBeVisible();
  await guide
    .getByRole("button", { name: "先生成排桌方案", exact: true })
    .click();
  await page.getByRole("button", { name: "生成建议预览", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("0");
  await page.getByRole("button", { name: "确认应用建议", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "宾客已安排，核对后即可导出" }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("6");
  await page.reload();
  await expect(
    guide.getByRole("heading", { name: "宾客已安排，核对后即可导出" }),
  ).toBeVisible();
  if (process.env.CAPTURE_ONBOARDING)
    await page.screenshot({
      path: `output/playwright/onboarding/ready-${testInfo.project.name}.png`,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await guide
    .getByRole("link", { name: "查看并导出名单", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载宾客CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});

test("按需工具：菜单焦点、空状态重做、筛选批量和全不参加的引导", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "新建活动", exact: true }).click();
  await page.getByLabel("活动名称", { exact: true }).fill("虚构按需工具验收");
  await page.getByRole("button", { name: "保存活动", exact: true }).click();
  const guide = page.getByRole("region", { name: "排桌流程与下一步" });
  await expect(
    guide.getByRole("heading", { name: "先把宾客名单加进来" }),
  ).toBeVisible();
  const more = page.locator(".workspace-more > summary");
  await more.click();
  await page.getByRole("button", { name: "编辑活动", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(more).toBeFocused();
  await expect(
    page.getByRole("button", { name: "编辑活动", exact: true }),
  ).toBeHidden();
  await more.click();
  await page.getByRole("button", { name: "先设置桌位", exact: true }).click();
  await page.getByLabel("展示桌号", { exact: true }).fill("临时虚构桌");
  await page.getByRole("button", { name: "保存桌位", exact: true }).click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "重做", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("1");
  await page.getByRole("button", { name: "撤销", exact: true }).click();

  await guide.getByRole("button", { name: "逐组添加", exact: true }).click();
  await page
    .getByLabel("名称 / 家庭或团队", { exact: true })
    .fill("虚构入门家庭");
  await page.getByLabel("人数", { exact: true }).fill("4");
  await page.getByRole("button", { name: "保存宾客组", exact: true }).click();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("4");
  await expect(page.getByLabel("出席筛选")).toBeHidden();
  await page.locator(".filter-options > summary").click();
  await page.getByLabel("出席筛选").selectOption("declined");
  await expect(
    page.getByText("没有符合筛选的宾客，请调整或清除筛选。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await page.locator(".filter-options > summary").click();
  await page
    .getByRole("checkbox", { name: "选择 虚构入门家庭", exact: true })
    .check();
  await expect(page.getByLabel("批量目标桌")).toBeVisible();
  await page
    .getByRole("checkbox", { name: "选择 虚构入门家庭", exact: true })
    .uncheck();
  await expect(page.getByLabel("批量目标桌")).toHaveCount(0);

  await guide
    .getByRole("button", { name: "添加第一张圆桌", exact: true })
    .click();
  await page.getByLabel("展示桌号", { exact: true }).fill("虚构小桌");
  await page.getByLabel("容量", { exact: true }).fill("3");
  await page.getByRole("button", { name: "保存桌位", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "圆桌容量还不够" }),
  ).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "增加一张圆桌", exact: true }),
  ).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "先生成排桌方案", exact: true }),
  ).toHaveCount(0);
  const row = page
    .locator(".guest-management tr")
    .filter({ has: page.getByText("虚构入门家庭", { exact: true }) });
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await page
    .getByRole("combobox", { name: "出席状态", exact: true })
    .selectOption("declined");
  await page.getByRole("button", { name: "保存宾客组", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "当前没有计划出席的宾客" }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("0");
  await expect(
    guide.getByRole("link", { name: "查看并导出名单", exact: true }),
  ).toHaveCount(0);
  const safety = page.locator(".safety-panel");
  await expect(
    safety.getByRole("button", { name: "保存本地检查点", exact: true }),
  ).toBeHidden();
  await safety.locator(".safety-advanced > summary").click();
  await safety
    .getByRole("button", { name: "保存本地检查点", exact: true })
    .click();
  await expect(safety.getByRole("status")).toContainText("检查点已保存");
});
