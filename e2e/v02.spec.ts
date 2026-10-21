import { openExtra } from "./interactions.js";
import { test, expect } from "@playwright/test";
async function demo(page: import("@playwright/test").Page) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await page.getByRole("button", { name: "场地平面图", exact: true }).click();
}
test("V02 平面图菜单安排、坐标、区域、刷新和锁定保护", async ({
  page,
}, testInfo) => {
  await demo(page);
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await page
    .getByLabel("平面图选择宾客入桌")
    .selectOption({ label: "示例小禾一家（4人）" });
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByLabel("选中项X坐标").fill("500");
  await page.getByLabel("选中项Y坐标").fill("400");
  await page.getByRole("button", { name: "保存位置", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^平面图 03 桌/ }),
  ).toBeVisible();
  await page.locator(".plan-edit-tools > summary").click();
  await page.getByRole("button", { name: "添加舞台 / 入口" }).click();
  await page.getByLabel("区域名称").fill("虚构舞台");
  await page.getByLabel("区域X坐标").fill("600");
  await page.getByRole("button", { name: "保存区域", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "区域 虚构舞台", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "场地平面图", exact: true }).click();
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await expect(page.getByLabel("选中项X坐标")).toHaveValue("500");
  await expect(page.getByLabel("选中项Y坐标")).toHaveValue("400");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v02/plan-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "名单与桌位", exact: true }).click();
  const row = page.locator("tr").filter({
    has: page.getByRole("button", { name: "查看 03 桌详情", exact: true }),
  });
  await row.getByRole("button", { name: "锁定", exact: true }).click();
  await page.getByRole("button", { name: "场地平面图", exact: true }).click();
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await expect(page.getByLabel("选中项X坐标")).toBeDisabled();
  await expect(page.getByLabel("平面图选择宾客入桌")).toBeDisabled();
});
test("V02 场地图SVG、PNG真实下载和打印预览", async ({
  page,
  browserName,
}, testInfo) => {
  const { readFile } = await import("node:fs/promises");
  await demo(page);
  await page.getByRole("link", { name: "导出场地图", exact: true }).click();
  const image = page.getByRole("img", { name: /场地圆桌分配图/ });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  const svgWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载SVG场地图" }).click();
  const svgPath = testInfo.outputPath("fictional-plan.svg");
  await (await svgWait).saveAs(svgPath);
  const svg = await readFile(svgPath, "utf8");
  expect(svg).toContain("计划 11 人");
  expect(svg).not.toContain("示例小禾一家");
  const pngWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载PNG场地图" }).click();
  const pngPath = testInfo.outputPath("fictional-plan.png");
  await (await pngWait).saveAs(pngPath);
  const png = await readFile(pngPath);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBeLessThanOrEqual(4096);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("button", { name: "下载SVG场地图" }),
  ).toBeHidden();
  await expect(image).toBeVisible();
  if (browserName === "chromium")
    await page.pdf({
      path: testInfo.outputPath("fictional-plan.pdf"),
      format: "A4",
      landscape: true,
    });
});

test("V02 命名方案比较调桌与布局，恢复保护当前状态，规则先预览可撤销", async ({
  page,
}, testInfo) => {
  await demo(page);
  await openExtra(page, "命名方案与差异");
  const dialog = page.getByRole("dialog");
  await page.getByLabel("新方案名称").fill("虚构初稿");
  await page.getByRole("button", { name: "保存当前为命名方案" }).click();
  await expect(dialog.getByRole("status")).toHaveText("命名方案已保存");
  await dialog.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await page
    .getByLabel("平面图选择宾客入桌")
    .selectOption({ label: "示例小禾一家（4人）" });
  await page.getByLabel("选中项X坐标").fill("500");
  await page.getByLabel("选中项Y坐标").fill("400");
  await page.getByRole("button", { name: "保存位置", exact: true }).click();
  await openExtra(page, "命名方案与差异");
  await page.getByLabel("比较起点").selectOption({ index: 2 });
  await expect(
    dialog.getByRole("cell", { name: "调桌", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "桌位置", exact: true }),
  ).toBeVisible();
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v02/versions-${testInfo.project.name}.png`,
    });
  await page.getByRole("button", { name: "恢复此命名方案" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "恢复前状态已保存在检查点",
  );
  await dialog.getByRole("button", { name: "完成", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("0");
  await openExtra(page, "规则排桌建议");
  await page.getByRole("button", { name: "生成建议预览" }).click();
  await expect(dialog.getByRole("status")).toContainText("5 组 / 11 人");
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("0");
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v02/suggestions-${testInfo.project.name}.png`,
    });
  await page.getByRole("button", { name: "确认应用建议" }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("11");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("0");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  // The click starts a transaction; verify its committed result before testing persistence.
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("11");
  await page.reload();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("11");
});

test("V02 桌位真实拖动与键盘定位，宾客整组拖入或手机菜单", async ({
  page,
}, testInfo) => {
  await demo(page);
  await page.getByRole("button", { name: "调整布局", exact: true }).click();
  const table = page.getByRole("button", { name: /^平面图 03 桌/ });
  await table.click();
  if (!testInfo.project.use.isMobile) {
    await table.scrollIntoViewIfNeeded();
    const box = (await table.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 45,
      box.y + box.height / 2 + 40,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(page.getByLabel("选中项X坐标")).not.toHaveValue("250");
    const x = Number(await page.getByLabel("选中项X坐标").inputValue());
    await table.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel("选中项X坐标")).toHaveValue(String(x + 10));
  }
  await page.getByRole("button", { name: "安排宾客", exact: true }).click();
  if (testInfo.project.use.isMobile) {
    await table.click();
    await page
      .getByLabel("平面图选择宾客入桌")
      .selectOption({ label: "示例小禾一家（4人）" });
  } else {
    const source = page.getByRole("button", {
      name: "平面图拖动 示例小禾一家",
      exact: true,
    });
    await page.locator(".plan-layout").scrollIntoViewIfNeeded();
    const a = (await source.boundingBox())!,
      b = (await table.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, {
      steps: 3,
    });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    await expect(page.locator(".plan-drop")).toHaveCount(1);
    await page.mouse.up();
  }
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
});

test("V02 完整备份恢复新活动保留场地、坐标与命名方案", async ({
  page,
}, testInfo) => {
  const { readFile } = await import("node:fs/promises");
  await demo(page);
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await page.getByLabel("选中项X坐标").fill("650");
  await page.getByLabel("选中项Y坐标").fill("500");
  await page.getByRole("button", { name: "保存位置", exact: true }).click();
  await openExtra(page, "命名方案与差异");
  await page.getByLabel("新方案名称").fill("虚构场地确认稿");
  await page.getByRole("button", { name: "保存当前为命名方案" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "命名方案已保存",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "完成", exact: true })
    .click();
  await page
    .getByRole("button", { name: "完整备份与恢复", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载本活动完整备份", exact: true })
    .click();
  const path = testInfo.outputPath("fictional-v02.json");
  await (await pending).saveAs(path);
  const bundle = JSON.parse(await readFile(path, "utf8"));
  expect(bundle.schemaVersion).toBe(2);
  expect(bundle.checkpoints[0].name).toBe("虚构场地确认稿");
  await page.getByLabel("选择 JSON 备份（最多10MB）").setInputFiles(path);
  await page.getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "虚构演示婚宴（恢复）", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "场地平面图", exact: true }).click();
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await expect(page.getByLabel("选中项X坐标")).toHaveValue("650");
  await openExtra(page, "命名方案与差异");
  await expect(page.getByLabel("重命名方案 虚构场地确认稿")).toBeVisible();
});

test("V02 建议预览期间外部变更使旧预览失效", async ({ page, context }) => {
  await demo(page);
  const url = page.url();
  await openExtra(page, "规则排桌建议");
  await page.getByRole("button", { name: "生成建议预览" }).click();
  const other = await context.newPage();
  other.on("dialog", (d) => d.accept());
  try {
    await other.goto(url);
    await other
      .getByRole("button", { name: "名单与桌位", exact: true })
      .click();
    const row = other
      .locator("tr")
      .filter({ has: other.getByText("示例小禾一家", { exact: true }) });
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    await other.getByLabel("人数", { exact: true }).fill("5");
    await other.getByRole("button", { name: "保存宾客组" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "预览后数据已变化",
    );
    await expect(
      page.getByRole("button", { name: "确认应用建议" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "生成建议预览" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "12 人",
    );
  } finally {
    await other.close();
  }
});

test("V02 场地演示直达可视化，12张跳号桌与完整区域", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "试用场地平面图演示", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "虚构场地图演示", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("12");
  await expect(page.getByTestId("stat-计划出席")).toHaveText("122");
  await expect(page.locator(".plan-table")).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: "区域 舞台", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v02/venue-demo-${testInfo.project.name}.png`,
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "导出场地图", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载PNG场地图" }).click();
  await (await pending).saveAs(testInfo.outputPath("fictional-venue-demo.png"));
});

test("UI走查：点选整组安排、容量提示、视图刷新和手机详情入口", async ({
  page,
}, testInfo) => {
  await demo(page);
  const pending = page.locator(".plan-pending");
  const disclosure = pending.locator("summary");
  if (
    !(await pending
      .locator("details")
      .evaluate((el: HTMLDetailsElement) => el.open))
  )
    await disclosure.click();
  await page
    .getByRole("button", { name: "平面图拖动 示例小禾一家", exact: true })
    .click();
  const target = page.getByLabel("为选中宾客选择圆桌");
  await expect(target).toBeVisible();
  await target.selectOption({ label: "03 桌 · 余 10 席" });
  await page.getByRole("button", { name: "确认安排整组" }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await expect(
    page.getByRole("status").filter({ hasText: "变更已保存" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭操作反馈" }).click();
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  if (
    testInfo.project.use.isMobile ||
    testInfo.project.name === "tablet-webkit"
  ) {
    await page.getByRole("button", { name: "查看选中项详情与名单 ↓" }).click();
    await expect(page.locator("#plan-inspector")).toBeFocused();
  }
  if (process.env.CAPTURE_REVIEW) {
    await page.locator(".floorplan-feature").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `output/playwright/ui-review/plan-${testInfo.project.name}.png`,
    });
  }
  const move = page.getByLabel("平面图移动 示例小禾一家");
  await expect(move.locator("option:checked")).toHaveText(
    "03 桌 · 余 6 席 · 当前桌",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "场地平面图", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "排桌工作台", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "排桌工作台", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "名单与桌位", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "名单与桌位", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("名单布局：20桌零宾客与少量宾客均无侧栏空白，末桌仍可操作", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建活动", exact: true }).click();
  await page.getByLabel("活动名称", { exact: true }).fill("虚构二十桌布局验收");
  await page.getByLabel("初始桌数", { exact: true }).fill("20");
  await page.getByRole("button", { name: "保存活动", exact: true }).click();
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("20");
  await expect(
    page.getByRole("heading", { name: "桌位已就绪，接下来添加名单" }),
  ).toBeVisible();
  await expect(page.locator(".table-management tbody tr")).toHaveCount(20);
  const tablePanel = page.locator(".table-management");
  const guestPanel = page.locator(".guest-management");
  const tableBounds = (await tablePanel.boundingBox())!;
  const guestBounds = (await guestPanel.boundingBox())!;
  expect(Math.abs(tableBounds.width - guestBounds.width)).toBeLessThan(2);
  expect(guestBounds.y).toBeGreaterThanOrEqual(
    tableBounds.y + tableBounds.height,
  );
  expect(tableBounds.height).toBeLessThan(510);
  await page
    .getByRole("button", { name: "查看 20 桌详情", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "导入已有名单", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  if (process.env.CAPTURE_LAYOUT) {
    await page.locator(".workspace-grid").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `output/playwright/list-layout/empty-${testInfo.project.name}.png`,
    });
  }
  await page.getByRole("button", { name: "新增宾客组", exact: true }).click();
  await page
    .getByLabel("名称 / 家庭或团队", { exact: true })
    .fill("虚构四人家庭");
  await page.getByLabel("人数", { exact: true }).fill("4");
  await page.getByRole("button", { name: "保存宾客组", exact: true }).click();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("4");
  await expect(
    guestPanel.getByText("虚构四人家庭", { exact: true }),
  ).toBeVisible();
  expect((await guestPanel.boundingBox())!.width).toBeCloseTo(
    tableBounds.width,
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("布局规则：中央过道预览确认/撤销，新增找空位，过道禁放与拖动吸附", async ({
  page,
}, testInfo) => {
  await demo(page);
  await page.getByRole("button", { name: "一键整理", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("img", { name: "自动整理布局预览" }),
  ).toBeVisible();
  await page.getByLabel("每行最多桌数", { exact: true }).fill("4");
  await page.getByLabel("列间净距", { exact: true }).fill("80");
  await expect(dialog.getByRole("status")).toContainText("新增中央过道");
  if (process.env.CAPTURE_LAYOUT_RULES)
    await page.screenshot({
      path: `output/playwright/layout-rules/preview-${testInfo.project.name}.png`,
    });
  await page.getByRole("button", { name: "确认整理布局", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "区域 中央过道", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "区域 中央过道", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await page.getByRole("button", { name: "调整布局", exact: true }).click();
  const selectedTable = page.getByRole("button", { name: /^平面图 03 桌/ });
  const originalX = await selectedTable.evaluate((el) =>
    String(parseFloat((el.parentElement as HTMLElement).style.left) + 48),
  );
  await selectedTable.click();
  await expect(page.getByLabel("选中项X坐标")).toHaveValue(originalX);
  await page.getByRole("button", { name: "安排宾客", exact: true }).click();
  await page.getByLabel("选中项X坐标").fill("600");
  await page.getByLabel("选中项Y坐标").fill("400");
  await page.getByRole("button", { name: "保存位置", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("过道");
  await page.getByRole("button", { name: "关闭操作反馈" }).click();
  await page.getByRole("button", { name: "新增桌位", exact: true }).click();
  await page.getByLabel("展示桌号", { exact: true }).fill("88");
  await page.getByRole("button", { name: "保存桌位", exact: true }).click();
  await expect(page.getByTestId("stat-桌位数量")).toHaveText("4");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "区域 中央过道", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "调整布局", exact: true }).click();
  const table = page.getByRole("button", { name: /^平面图 88 桌/ });
  await table.click();
  const oldX = Number(await page.getByLabel("选中项X坐标").inputValue());
  expect(oldX < 468 || oldX > 732).toBe(true);
  if (!testInfo.project.use.isMobile) {
    await table.scrollIntoViewIfNeeded();
    const box = (await table.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 15,
      box.y + box.height / 2 + 35,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          Number(await page.getByLabel("选中项X坐标").inputValue()) % 20,
      )
      .toBe(0);
    await expect
      .poll(
        async () =>
          Number(await page.getByLabel("选中项Y坐标").inputValue()) % 20,
      )
      .toBe(0);
  }
  await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
});

test("场地图名单总览：家庭人数、同名独立、换桌同步与刷新开关", async ({
  page,
}, testInfo) => {
  await demo(page);
  await expect(
    page.getByRole("region", { name: "01桌宾客名单", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "显示宾客名单", exact: true })
    .check();
  await expect(page.getByRole("region", { name: /桌宾客名单$/ })).toHaveCount(
    3,
  );
  await expect(
    page.getByRole("region", { name: "01桌宾客名单", exact: true }),
  ).toHaveText("暂无宾客");
  await page.getByRole("button", { name: /^平面图 03 桌/ }).click();
  await page
    .getByLabel("平面图选择宾客入桌")
    .selectOption({ label: "示例小禾一家（4人）" });
  await expect(
    page.getByRole("region", { name: "03桌宾客名单", exact: true }),
  ).toContainText("示例小禾一家×4");
  await page
    .getByLabel("平面图移动 示例小禾一家")
    .selectOption({ label: "66 桌 · 余 10 席" });
  await expect(
    page.getByRole("region", { name: "03桌宾客名单", exact: true }),
  ).toHaveText("暂无宾客");
  await expect(
    page.getByRole("region", { name: "66桌宾客名单", exact: true }),
  ).toContainText("示例小禾一家×4");
  await page.getByRole("button", { name: "名单与桌位", exact: true }).click();
  const duplicates = page.getByLabel("安排 示例云朵 的桌位", { exact: true });
  await duplicates.nth(0).selectOption({ label: "66 桌" });
  await duplicates.nth(1).selectOption({ label: "66 桌" });
  await page.getByRole("button", { name: "场地平面图", exact: true }).click();
  const roster = page.getByRole("region", {
    name: "66桌宾客名单",
    exact: true,
  });
  await expect(roster.getByRole("listitem")).toHaveCount(3);
  await expect(
    roster.getByRole("listitem").filter({ hasText: "示例云朵" }),
  ).toHaveCount(2);
  await expect(roster.getByText("待定", { exact: true })).toBeVisible();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("6");
  await page.getByRole("button", { name: /^平面图 66 桌/ }).click();
  const x = await page.getByLabel("选中项X坐标").inputValue();
  const y = await page.getByLabel("选中项Y坐标").inputValue();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "显示宾客名单", exact: true }),
  ).toBeChecked();
  await expect(roster.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("6");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await roster.scrollIntoViewIfNeeded();
  if (process.env.CAPTURE_ROSTERS)
    await page.screenshot({
      path: `output/playwright/rosters/names-${testInfo.project.name}.png`,
    });
  await page
    .getByRole("checkbox", { name: "显示宾客名单", exact: true })
    .uncheck();
  await expect(page.getByRole("region", { name: /桌宾客名单$/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /^平面图 66 桌/ }).click();
  await expect(page.getByLabel("选中项X坐标")).toHaveValue(x);
  await expect(page.getByLabel("选中项Y坐标")).toHaveValue(y);
  await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
});

test("名单视图拖动与键盘仍按真实坐标移动，名单滚动不移动桌", async ({
  page,
  isMobile,
}) => {
  await demo(page);
  await page
    .getByRole("checkbox", { name: "显示宾客名单", exact: true })
    .check();
  await page.getByRole("button", { name: "调整布局", exact: true }).click();
  const table = page.getByRole("button", { name: /^平面图 01 桌/ });
  await table.click();
  const x = Number(await page.getByLabel("选中项X坐标").inputValue());
  if (!isMobile) {
    const box = await table.boundingBox();
    const scale = await page
      .locator(".plan-world")
      .evaluate((element) =>
        Number(getComputedStyle(element).transform.split("(")[1].split(",")[0]),
      );
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 40 * scale * 2.6,
      box!.y + box!.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(page.getByLabel("选中项X坐标")).toHaveValue(String(x + 40));
  } else {
    await page.getByLabel("选中项X坐标").fill(String(x + 40));
    await page.getByRole("button", { name: "保存位置", exact: true }).click();
  }
  await expect(page.getByLabel("选中项X坐标")).toHaveValue(String(x + 40));
  // A filled input already contains the submitted value while the transaction is still busy.
  // Keyboard presses do not wait for a disabled target, so wait for the save to finish.
  await expect(table).toBeEnabled();
  await table.press("ArrowRight");
  await expect(page.getByLabel("选中项X坐标")).toHaveValue(String(x + 50));
  await expect(table).toBeEnabled();
  await page
    .getByRole("region", { name: "01桌宾客名单", exact: true })
    .press("ArrowDown");
  await expect(page.getByLabel("选中项X坐标")).toHaveValue(String(x + 50));
  await page.reload();
  await page.getByRole("button", { name: /^平面图 01 桌/ }).click();
  await expect(page.getByLabel("选中项X坐标")).toHaveValue(String(x + 50));
});
