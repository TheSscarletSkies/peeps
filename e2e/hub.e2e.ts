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
  await expect(tour).toContainText("Hi, I'm your peep");
  await tour.getByRole("button", { name: "Show me" }).click();
  await expect(tour).toContainText("Your list");
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: /^Chat/ })).toBeVisible();
  await tour.getByRole("button", { name: "Back" }).click();
  await expect(tour).toContainText("Your list");
  await tour.getByRole("button", { name: "Skip" }).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Tour" })).toHaveCount(0);
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(page.getByRole("dialog", { name: "Tour" })).toBeVisible();
});

test("UC14: Today shows what is left to set up", async ({ page }) => {
  const guide = page.getByRole("region", { name: "Getting started" });
  await expect(guide).toContainText("Say hi to Helper");
  await guide.getByRole("button", { name: "Hide" }).click();
  await expect(guide).toHaveCount(0);
});

test("UC11: reminder rules and calendars can be managed", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("When to remind")).toBeVisible();
  await expect(page.getByLabel("Words to match")).toHaveValue("class");
  await page.getByRole("button", { name: "Add a rule" }).click();
  await expect(page.getByLabel("Words to match")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Add calendar" }),
  ).toBeDisabled();
});

test("UC15: the window can switch to a light theme", async ({ page }) => {
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator(".hub")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator(".hub")).toHaveAttribute("data-theme", "light");
});

test("UC9: the Chat page talks to the helper", async ({ page }) => {
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Message Helper").fill("Plan my week");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("In the app I'd ask your agent")).toBeVisible();
});

test("UC16: devices can share a sync folder without an account", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Use peeps on all your computers")).toBeVisible();
  for (const drive of ["iCloud Drive", "OneDrive", "Dropbox", "Google Drive"]) {
    await expect(page.getByText(drive, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Choose a folder" }),
  ).toBeEnabled();
  await page.getByLabel("What stays on each computer").click();
  await expect(
    page.getByText("Calendar links and passwords stay"),
  ).toBeVisible();
});

test("UC14: without Claude Code, one click installs it", async ({ page }) => {
  await page.goto("/?view=home&claude=missing");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/Chat needs Claude Code/)).toBeVisible();
  await page.getByRole("button", { name: "Install Claude Code" }).click();
  await expect(page.getByText(/A window opened/)).toBeVisible();
  await page.getByText("Or paste this into a terminal yourself").click();
  await expect(page.locator(".install__command code")).toHaveText(
    "curl -fsSL https://claude.ai/install.sh | bash",
  );
});

test("UC17: Nudges switch on stretch, water and eye breaks", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Nudges" }).click();
  for (const name of [
    "Stand up and stretch",
    "Drink water",
    "Rest your eyes",
  ]) {
    await expect(page.getByRole("switch", { name })).toBeVisible();
  }
  await expect(
    page.getByRole("list", { name: "Your reminders" }),
  ).toBeVisible();
});

test("UC1: ticking a to-do on Today feeds the pet", async ({ page }) => {
  const box = page.getByLabel("Done: Read chapter 4");
  await box.click();
  await expect(
    page.locator(".hero .dumpling--love, .hero .pet-say").first(),
  ).toBeVisible();
});

test("UC23: a focus session counts down", async ({ page }) => {
  const bar = page.getByRole("form", { name: "Focus" });
  await bar.getByLabel("What are you focusing on?").fill("essay");
  await bar.getByRole("radio", { name: "50" }).click();
  await bar.getByRole("button", { name: "Focus" }).click();
  const session = page.getByRole("region", { name: "Focus session" });
  await expect(session).toContainText("Focusing on essay");
  await expect(session.getByRole("timer")).toHaveText(/^(50:00|49:5\d)$/);
  await session.getByRole("button", { name: "Stop" }).click();
  await expect(session).toHaveCount(0);
});

test("UC24: one thing at a time is off until switched on", async ({ page }) => {
  await page.getByRole("button", { name: "Nudges" }).click();
  const guard = page.getByRole("switch", { name: "One thing at a time" });
  await expect(guard).toHaveAttribute("aria-checked", "false");
  await guard.click();
  await expect(guard).toHaveAttribute("aria-checked", "true");
});

test("UC26: friends studying sit at the table and can be joined", async ({
  page,
}) => {
  await expect(page.locator(".hero .desk__tag")).toHaveText([
    "Mariyam",
    "Sara",
  ]);
  await page.getByRole("button", { name: "Join Sara" }).click();
  const session = page.getByRole("region", { name: "Focus session" });
  await expect(session).toContainText("Focusing with Sara");
});

test("UC27: Today groups the list by area and shows a week of habits", async ({
  page,
}) => {
  const list = page.getByRole("region", { name: "Your list" });
  await expect(list.locator(".area__head")).toHaveText([
    /^Work/,
    /^Study/,
    /^Play/,
    /^Everything else/,
  ]);
  const week = page.getByRole("table", { name: "This week" });
  await expect(week.getByRole("row", { name: /Stretch/ })).toContainText(
    "6 in a row",
  );
  await expect(week.locator(".week__dot[data-done]").first()).toBeVisible();
});

test("UC27: areas can be added and removed in Settings", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  const areas = page.getByRole("list", { name: "Your areas" });
  await expect(areas).toContainText("#work");
  await page.getByLabel("New area").fill("Gym");
  await page.getByLabel("New area").press("Enter");
  await expect(areas).toContainText("#gym");
  await areas.getByRole("button", { name: "Remove play" }).click();
  await expect(areas).not.toContainText("#play");
});

test("UC23: a study session says so", async ({ page }) => {
  const bar = page.getByRole("form", { name: "Focus" });
  await bar.getByRole("radio", { name: "Study" }).click();
  await bar.getByRole("button", { name: "Study", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Focus session" }),
  ).toContainText("Studying ·");
});
