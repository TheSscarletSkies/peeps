import { expect, test } from "@playwright/test";

import { choose } from "./choose";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Helper/ }).click();
  // The preview has an email waiting, so the card opens on Mail.
  await page.getByRole("tab", { name: "Ask", exact: true }).click();
});

test("UC9: the helper answers a message", async ({ page }) => {
  await page.getByLabel("Message Helper").fill("What's on today?");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Thinking")).toBeVisible();
  await expect(page.getByText("In the app I'd ask your agent")).toBeVisible();
});

test("UC9: model and effort are picked from the chip, never forced", async ({
  page,
}) => {
  await expect(
    page.getByRole("region", { name: "Choose a model" }),
  ).toHaveCount(0);
  await page.getByTitle("Change model and effort").click();
  const picker = page.getByRole("region", { name: "Choose a model" });
  await picker.getByRole("radio", { name: "Opus" }).click();
  await picker.getByRole("radio", { name: "High" }).click();
  await picker.getByRole("button", { name: "Use Opus · High" }).click();
  await expect(picker).toHaveCount(0);
});

test("UC10: to-dos take tags, dates and reminders", async ({ page }) => {
  await page.getByRole("tab", { name: "To-do" }).click();
  await page.getByLabel("To-do").last().fill("Pay rent #bills");
  await expect(page.getByLabel("Reminder")).toHaveCount(0);
  await page.getByLabel("Due date").last().fill("2026-11-01");
  await expect(page.getByLabel("Reminder")).toBeVisible();
  await choose(page.getByLabel("Repeat").last(), "Monthly");
  await expect(page.getByRole("button", { name: "Add" })).toBeEnabled();

  await page
    .getByRole("toolbar", { name: "Filter by tag" })
    .getByText("#study")
    .click();
  await expect(page.locator(".todos li")).toHaveCount(1);
});

test("UC10: nudges through the day get a from–to window", async ({ page }) => {
  await page.getByRole("tab", { name: "To-do" }).click();
  await expect(page.getByText(/Every 2 h · 3 of \d+ today/)).toBeVisible();
  await page.getByLabel("To-do").last().fill("Stretch");
  await choose(page.getByLabel("Repeat").last(), "Every 2 hours");
  await expect(page.getByLabel("Due date")).toHaveCount(0);
  await expect(page.getByLabel("From")).toHaveValue("09:00");
  await expect(page.getByLabel("Until")).toHaveValue("21:00");
});

test("UC12: a draft can be scheduled to repeat", async ({ page }) => {
  await page.getByRole("tab", { name: "Write" }).click();
  await expect(
    page.getByRole("list", { name: "Scheduled drafts" }),
  ).toContainText("What I shipped this week");
  await choose(page.getByLabel("When"), "Weekly");
  await expect(page.getByLabel("Starting")).toBeVisible();
  await page.getByLabel("What to write about").fill("A week of peeps");
  await expect(page.getByRole("button", { name: "Schedule" })).toBeEnabled();
});

test("UC10: a daily habit done today waits for tomorrow", async ({ page }) => {
  await page.getByRole("tab", { name: "To-do" }).click();
  const stretch = page.getByLabel("Done: Stretch");
  await expect(stretch).toBeChecked();
  await expect(stretch).toBeDisabled();
  await expect(page.getByText(/Done today · 6 in a row/)).toBeVisible();
});

test("UC9: the card closes with its × button", async ({ page }) => {
  const card = page.locator(".notch__card");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toHaveCount(0);
});

test("UC9: the model picker has a way back", async ({ page }) => {
  await page.getByTitle("Change model and effort").click();
  const picker = page.getByRole("region", { name: "Choose a model" });
  await picker.getByRole("button", { name: "Back to the chat" }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByLabel("Message Helper")).toBeVisible();
});

test("UC8: pat the pet at the top of its card and it answers", async ({
  page,
}) => {
  await page.locator(".panel__head--pet .live-pet").click();
  await expect(page.locator(".pet-say")).toBeVisible();
  await expect(page.locator(".panel__head--pet .dumpling--love")).toBeVisible();
});
