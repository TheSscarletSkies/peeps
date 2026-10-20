import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("UC1: every product and the helper live in the notch", async ({
  page,
}) => {
  for (const name of [
    "Funderly",
    "Enigma Archives",
    "Kaiveni Hiya",
    "Helper",
  ]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${name}`) }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Funderly: Needs you" }),
  ).toBeVisible();
});

test("UC2: a waiting command can be allowed from the pet's card", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Funderly/ }).click();
  await expect(page.locator(".panel__permission code")).toHaveText(
    "git push origin main",
  );
  await expect(page.getByRole("button", { name: "Allow" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".notch__card")).toHaveCount(0);
});

test("UC3: a note can be fed to a product", async ({ page }) => {
  await page.getByRole("button", { name: /^Enigma Archives/ }).click();
  await page
    .getByLabel("Note for Enigma Archives")
    .fill("Post the Halloween story first");
  await page.getByRole("button", { name: "Feed" }).click();
  await expect(
    page.getByText("reads this when its next session starts"),
  ).toBeVisible();
});

test("UC6: pets can be hidden and resized", async ({ page }) => {
  await page.getByRole("button", { name: /^All pets/ }).click();
  await page.getByRole("button", { name: "Hide Kaiveni Hiya" }).click();
  await page.getByRole("radio", { name: "large" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Kaiveni Hiya/ })).toHaveCount(
    0,
  );
  // Hungry pets come out even when hidden.
  await page.getByRole("button", { name: /^All pets/ }).click();
  await page.getByRole("button", { name: "Hide Enigma Archives" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /^Enigma Archives/ }),
  ).toBeVisible();
});

test("UC6: a pet can be dragged across the notch without opening its card", async ({
  page,
}) => {
  const pet = page.getByRole("button", { name: /^Kaiveni Hiya/ });
  const before = await pet.boundingBox();
  if (!before) throw new Error("pet not on screen");
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(before.x + 10 + step * 30, before.y + 10);
  }
  await page.mouse.up();
  const after = await pet.boundingBox();
  expect(after?.x ?? 0).toBeGreaterThan(before.x + 150);
  await expect(page.locator(".notch__card")).toHaveCount(0);
});
