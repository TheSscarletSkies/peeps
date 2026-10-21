import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("UC1: only the companion lives in the notch", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^Helper/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Funderly/ })).toHaveCount(0);
});

test("UC6: the companion can be resized", async ({ page }) => {
  const pet = page.getByRole("button", { name: /^Helper/ });
  const before = await pet.boundingBox();
  await page.getByRole("button", { name: /^All pets/ }).click();
  await page.getByRole("radio", { name: "large" }).click();
  await page.keyboard.press("Escape");
  const after = await pet.boundingBox();
  expect(after?.width ?? 0).toBeGreaterThan(before?.width ?? 0);
});

test("UC6: the pet can be dragged across the notch without opening its card", async ({
  page,
}) => {
  const pet = page.getByRole("button", { name: /^Helper/ });
  const before = await pet.boundingBox();
  if (!before) throw new Error("pet not on screen");
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(before.x + 10 + step * 30, before.y + 10);
  }
  await page.mouse.up();
  const after = await pet.boundingBox();
  expect(Math.abs((after?.x ?? 0) - before.x)).toBeGreaterThan(150);
  await expect(page.locator(".notch__card")).toHaveCount(0);
});
