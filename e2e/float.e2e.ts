import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?notch=none");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("UC7: without a notch the helper floats, counting pets that need you", async ({
  page,
}) => {
  const helper = page.locator(".float__pet");
  await expect(helper).toBeVisible();
  await expect(helper.locator(".float__badge")).toHaveText(/\d+/);
  await helper.click();
  await expect(page.getByRole("tab", { name: /Funderly/ })).toBeVisible();
  await page.getByRole("tab", { name: /Funderly/ }).click();
  await expect(page.getByLabel("Note for Funderly")).toBeVisible();
});

test("UC7: the floating pet remembers where it was put", async ({ page }) => {
  const helper = page.locator(".float__pet");
  const start = await helper.boundingBox();
  if (!start) throw new Error("helper not on screen");
  await page.mouse.move(start.x + 38, start.y + 38);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(start.x + 38 - step * 50, start.y + 38 - step * 30);
  }
  await page.mouse.up();
  await page.reload();
  const moved = await page.locator(".float__pet").boundingBox();
  expect(moved?.x ?? 0).toBeLessThan(start.x - 300);
});
