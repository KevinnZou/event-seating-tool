import { test, expect } from "@playwright/test";
test("导入纠错、同名保留、搜索、批量移桌与撤销重做", async ({
  page,
}, testInfo) => {
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
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v01/import-${testInfo.project.name}.png`,
      fullPage: true,
    });
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
  await page.getByLabel("搜索目标桌号").fill("01");
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
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v01/board-${testInfo.project.name}.png`,
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("完整备份下载、清空、恢复、报表与打印预览", async ({ page }, testInfo) => {
  const { readFile } = await import("node:fs/promises");
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await page
    .getByLabel("安排 示例小禾一家 的桌位")
    .selectOption({ label: "03 桌" });
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page
    .getByRole("button", { name: "完整备份与恢复", exact: true })
    .click();
  const backupWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载本活动完整备份", exact: true })
    .click();
  const backup = await backupWait;
  const backupPath = testInfo.outputPath("fictional-backup.json");
  await backup.saveAs(backupPath);
  const bundle = JSON.parse(await readFile(backupPath, "utf8"));
  expect(bundle.guestGroups).toHaveLength(6);
  await page
    .getByRole("button", { name: "关闭备份与恢复", exact: true })
    .click();
  await page.getByRole("link", { name: "← 返回本地活动" }).click();
  await page
    .getByRole("button", { name: "清空全部本地数据", exact: true })
    .click();
  await page.getByLabel("输入“清空全部本地数据”确认").fill("清空全部本地数据");
  await page
    .getByRole("button", { name: "确认清空全部本地数据", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "从一场活动开始" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "备份与恢复", exact: true }).click();
  await page.getByLabel("选择 JSON 备份（最多10MB）").setInputFiles(backupPath);
  await expect(page.getByText(/已验证：1 场活动/)).toBeVisible();
  await page.getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "虚构演示婚宴（恢复）" }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("11");
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.reload();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await page.getByRole("link", { name: "导出交付", exact: true }).click();
  const csvWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载宾客CSV" }).click();
  const csv = await csvWait,
    csvPath = testInfo.outputPath("fictional-guests.csv");
  await csv.saveAs(csvPath);
  expect(await readFile(csvPath, "utf8")).toContain("示例小禾一家,4");
  const excelWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载Excel工作簿" }).click();
  const excel = await excelWait;
  expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
  if (process.env.CAPTURE_QA)
    await page.screenshot({
      path: `docs/design/v01/export-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "虚构演示婚宴（恢复）" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "下载宾客CSV" })).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("print-preview.png"),
    fullPage: true,
  });
  await page.pdf({
    path: testInfo.outputPath("fictional-seating.pdf"),
    format: "A4",
    preferCSSPageSize: true,
  });
  await page.emulateMedia({ media: "screen" });
});

for (const people of [300, 500])
  test(`${people}人/${people / 10}桌虚构数据导入、搜索与移动`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    page.on("dialog", (d) => d.accept());
    await page.goto("/");
    await page.getByRole("button", { name: "新建活动", exact: true }).click();
    await page.getByLabel("活动名称").fill(`虚构性能${people}人`);
    await page.getByRole("button", { name: "保存活动", exact: true }).click();
    await page.getByRole("button", { name: "导入名单", exact: true }).click();
    const text = Array.from(
      { length: people / 10 },
      (_, t) =>
        `${String(t + 1).padStart(2, "0")}号桌：${Array.from({ length: t === 0 ? 7 : 10 }, (_, i) => `虚构性能${t + 1}桌${i + 1}组${t === 0 && i === 0 ? "一家(4)" : ""}`).join("、")}`,
    ).join("\n");
    const started = Date.now();
    await page.getByLabel("粘贴文本").fill(text);
    await page.getByRole("button", { name: "生成预览" }).click();
    await page.getByLabel("按默认容量自动创建未知桌号").check();
    await page.getByRole("button", { name: "核对完成，下一步" }).click();
    await page.getByRole("button", { name: "确认导入", exact: true }).click();
    await page.getByRole("button", { name: "完成", exact: true }).click();
    await expect(page.getByTestId("stat-计划出席")).toHaveText(String(people));
    await expect(page.getByTestId("stat-桌位数量")).toHaveText(
      String(people / 10),
    );
    const importedMs = Date.now() - started;
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "上一页", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    const startSearch = Date.now();
    await page.getByLabel("搜索宾客").fill("yijia");
    const menu = page.getByLabel("安排 虚构性能1桌1组一家 的桌位");
    await expect(menu).toBeVisible();
    const searchMs = Date.now() - startSearch;
    await menu.selectOption("");
    await expect(page.getByTestId("stat-未安排人数")).toHaveText("4");
    await menu.selectOption({ label: "01 桌" });
    await expect(page.getByTestId("stat-已安排人数")).toHaveText(
      String(people),
    );
    expect(searchMs).toBeLessThan(5000);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      testInfo.outputPath("performance.json"),
      JSON.stringify({ people, tables: people / 10, importedMs, searchMs }),
    );
    await testInfo.attach("performance.json", {
      body: JSON.stringify({
        people,
        tables: people / 10,
        importedMs,
        searchMs,
      }),
      contentType: "application/json",
    });
    if (people === 300 && testInfo.project.name === "chromium") {
      await page.getByRole("link", { name: "导出交付", exact: true }).click();
      await page.getByLabel("桌卡版式").check();
      await page.getByLabel("奇偶桌分组（自定义桌单列）").check();
      await page.emulateMedia({ media: "print" });
      await page.pdf({
        path: testInfo.outputPath("fictional-300-cards.pdf"),
        format: "A4",
        preferCSSPageSize: true,
      });
    }
  });

test("桌卡整组移动：桌面拖放与手机菜单", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await page.getByRole("button", { name: "排桌工作台", exact: true }).click();
  if (testInfo.project.name === "mobile") {
    await page
      .getByLabel("工作台安排 示例小禾一家")
      .selectOption({ label: "03 桌" });
  } else {
    const source = page.getByRole("button", {
      name: "拖动 示例小禾一家",
      exact: true,
    });
    const target = page.locator("section.board-zone").filter({
      has: page.getByRole("heading", { name: "03 桌", exact: true }),
    });
    await page.locator(".seating-board").scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();
    const a = await source.boundingBox(),
      b = await target.boundingBox();

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
    await page.mouse.down();
    await page.mouse.move(a!.x + a!.width / 2 + 12, a!.y + a!.height / 2 + 12, {
      steps: 3,
    });
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, {
      steps: 20,
    });
    await expect(target).toHaveClass(/drop-over/);
    await page.mouse.up();
  }
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("4");
  await expect(page.getByLabel("工作台安排 示例小禾一家")).not.toHaveValue("");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByTestId("stat-已安排人数")).toHaveText("0");
});

test("导入只能显式指定更新，保留ID且人数变更可见", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "试用虚构演示" }).click();
  await page.getByRole("button", { name: "导入名单", exact: true }).click();
  await page.getByLabel("粘贴文本").fill("虚构改名一家(3)");
  await page.getByRole("button", { name: "生成预览" }).click();
  await page.getByRole("button", { name: "指定更新", exact: true }).click();
  const option = page
    .getByLabel("第1行更新目标")
    .locator("option")
    .filter({ hasText: "示例小禾一家" });
  await page
    .getByLabel("第1行更新目标")
    .selectOption((await option.getAttribute("value"))!);
  await expect(page.getByText(/原4人 → 3人/)).toBeVisible();
  await page.getByRole("button", { name: "核对完成，下一步" }).click();
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "已新增 0 组，已更新 1 组",
  );
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(page.getByTestId("stat-计划出席")).toHaveText("10");
  await expect(
    page.getByRole("heading", { name: "宾客组（6）" }),
  ).toBeVisible();
});
