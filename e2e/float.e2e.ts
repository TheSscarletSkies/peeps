import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?notch=none");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("UC7: a click pats the floating pet; a double click opens it", async ({
  page,
}) => {
  const pet = page.locator(".float__pet");
  await pet.locator(".live-pet").click();
  await expect(page.locator(".float__panel")).toHaveCount(0);
  await expect(pet.locator(".dumpling--love")).toBeVisible();
  await pet.dblclick();
  await expect(page.getByRole("tab", { name: "Chat" })).toBeVisible();
});

test("UC7: right click opens the card too", async ({ page }) => {
  await page.locator(".float__pet").click({ button: "right" });
  await expect(page.getByRole("tab", { name: "Nudges" })).toBeVisible();
});

test("UC6: the floating pet comes in three sizes", async ({ page }) => {
  const pet = page.locator(".float__pet");
  const medium = await pet.boundingBox();
  await pet.click({ button: "right" });
  await page.getByRole("tab", { name: "Size and place" }).click();
  await page.getByRole("radio", { name: "small" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  const small = await pet.boundingBox();
  expect(small?.width ?? 0).toBeLessThan(medium?.width ?? 0);
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

test("UC26: studying with friends turns the peep into a little table", async ({
  page,
}) => {
  const pet = page.locator(".float__pet");
  await pet.dblclick();
  await page.getByRole("tab", { name: "Today" }).click();
  await page.getByRole("radio", { name: "Study" }).click();
  await page.getByRole("button", { name: "Study", exact: true }).click();
  await page.getByRole("button", { name: "Close" }).click();
  const desk = page.getByLabel("At the table: Mariyam, Sara");
  await expect(desk).toBeVisible();
  await expect(desk.locator(".desk__scene .dumpling__glasses")).toHaveCount(2);
  await expect(desk.locator(".desk__name")).toHaveText(["Mariyam", "Sara"]);
});
