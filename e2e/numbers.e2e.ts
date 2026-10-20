import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?view=home");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("peeps.tour", "done");
  });
  await page.reload();
});

test("UC20: a payment logged on a card shows up in its week", async ({
  page,
}) => {
  const funderly = page.getByLabel("Funderly this week").first();
  await expect(funderly).toContainText("$147 · 3 payments");
  await funderly.getByRole("button", { name: "+ Payment" }).click();
  await funderly.getByLabel("Amount").fill("49");
  await funderly.getByLabel("From").fill("Green Hope, bank transfer");
  await funderly.getByRole("button", { name: "Log" }).click();
  await expect(funderly.getByRole("status")).toHaveText("Payment logged");
  await expect(funderly).toContainText("$196 · 4 payments");
});

test("UC20: one tap marks a TikTok or Instagram post", async ({ page }) => {
  const enigma = page.getByLabel("Enigma Archives this week").first();
  await expect(enigma).toContainText("3 posts");
  await enigma.getByRole("button", { name: "Posted" }).click();
  await enigma
    .getByRole("group", { name: "Posted on" })
    .getByRole("button", { name: "TikTok" })
    .click();
  await expect(enigma.getByRole("status")).toHaveText("TikTok post logged");
  await expect(enigma).toContainText("4 posts · last just now");
  const kaiveni = page.getByLabel("Kaiveni Hiya this week").first();
  await expect(kaiveni).toHaveText(/Nothing logged this week/);
});

test("UC20: the Numbers page shows sources and entries", async ({ page }) => {
  await page.getByRole("button", { name: /^Numbers/ }).click();
  await expect(page.getByText("Payments go to Funderly")).toBeVisible();
  const entries = page.getByRole("list", { name: "Funderly entries" });
  await expect(entries).toContainText("Sara Bright");
  await entries.getByRole("button", { name: "Remove Sara Bright" }).click();
  await expect(entries).not.toContainText("Sara Bright");
  await expect(page.getByLabel("Enigma Archives YouTube channel")).toHaveValue(
    "UCabcdefghijklmnopqrstuv",
  );
  await page.getByText("Why not TikTok and Instagram?").click();
  await expect(page.getByText(/Tap Posted on a product's card/)).toBeVisible();
});
