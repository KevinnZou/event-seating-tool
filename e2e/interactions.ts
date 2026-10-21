import type { Page } from "@playwright/test";
/** Follow the visible advanced-action disclosure, preserving normal keyboard/button semantics. */
export async function openExtra(page: Page, name: string) {
  const action = page.getByRole("button", { name, exact: true });
  if (!(await action.isVisible()))
    await page.locator(".workspace-more > summary").click();
  await action.click();
}
