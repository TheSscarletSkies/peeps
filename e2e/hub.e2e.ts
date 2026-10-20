import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?view=home");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("peeps.tour", "done");
  });
  await page.reload();
});

test("UC14: a first visit gets a tour that can be followed or skipped", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.removeItem("peeps.tour"));
  await page.reload();
  const tour = page.getByRole("dialog", { name: "Tour" });
  await expect(tour).toContainText("Hi, I'm your helper");
  await tour.getByRole("button", { name: "Show me" }).click();
  await expect(tour).toContainText("Ask me anything");
  await expect(page.getByRole("heading", { name: /^Ask/ })).toBeVisible();
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour).toContainText("Your list");
  await tour.getByRole("button", { name: "Back" }).click();
  await expect(tour).toContainText("Ask me anything");
  await tour.getByRole("button", { name: "Skip" }).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Tour" })).toHaveCount(0);
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(page.getByRole("dialog", { name: "Tour" })).toBeVisible();
});

test("UC14: Home shows what is left to set up", async ({ page }) => {
  const guide = page.getByRole("region", { name: "Getting started" });
  await expect(guide).toContainText("Connect Claude Code");
  await guide.getByRole("button", { name: "Hide" }).click();
  await expect(guide).toHaveCount(0);
});

test("UC11: reminder rules and calendars can be managed", async ({ page }) => {
  await page.getByRole("button", { name: "Reminders" }).click();
  await expect(page.getByText("When to remind")).toBeVisible();
  await expect(page.getByLabel("Words to match")).toHaveValue("class");
  await page.getByRole("button", { name: "Add a rule" }).click();
  await expect(page.getByLabel("Words to match")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Add calendar" }),
  ).toBeDisabled();
});

test("UC13: the weekly recap can be saved as an image", async ({ page }) => {
  await page.getByRole("button", { name: "Recap" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save image" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});

test("UC15: the window can switch to a light theme", async ({ page }) => {
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator(".hub")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator(".hub")).toHaveAttribute("data-theme", "light");
});

test("UC9: the Ask page talks to the helper", async ({ page }) => {
  await page.getByRole("button", { name: "Ask" }).click();
  await page.getByLabel("Message Helper").fill("Plan my week");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("In the app I'd ask your agent")).toBeVisible();
});
