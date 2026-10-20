import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Helper/ }).click();
});

test("UC9: the helper answers a message", async ({ page }) => {
  await page.getByLabel("Message Helper").fill("What's on today?");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Thinking")).toBeVisible();
  await expect(page.getByText("In the app I'd ask your agent")).toBeVisible();
});

test("UC10: to-dos take tags, dates and reminders", async ({ page }) => {
  await page.getByRole("tab", { name: "To-do" }).click();
  await page.getByLabel("To-do").last().fill("Pay rent #bills");
  await expect(page.getByLabel("Reminder")).toHaveCount(0);
  await page.getByLabel("Due date").last().fill("2026-11-01");
  await expect(page.getByLabel("Reminder")).toBeVisible();
  await page.getByLabel("Repeat").last().selectOption("monthly");
  await expect(page.getByRole("button", { name: "Add" })).toBeEnabled();

  await page
    .getByRole("toolbar", { name: "Filter by tag" })
    .getByText("#study")
    .click();
  await expect(page.locator(".todos li")).toHaveCount(1);
});

test("UC12: a draft can be scheduled to repeat", async ({ page }) => {
  await page.getByRole("tab", { name: "Write" }).click();
  await expect(
    page.getByRole("list", { name: "Scheduled drafts" }),
  ).toContainText("What I shipped this week");
  await page.getByLabel("When").selectOption("weekly");
  await expect(page.getByLabel("Starting")).toBeVisible();
  await page.getByLabel("What to write about").fill("A week of peeps");
  await expect(page.getByRole("button", { name: "Schedule" })).toBeEnabled();
});
