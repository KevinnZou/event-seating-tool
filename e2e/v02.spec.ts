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
