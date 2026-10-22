import { expect, test } from "@playwright/test";

import { choose } from "./choose";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^Helper/ }).click();
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
  await page.getByRole("tab", { name: "Today" }).click();
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
  await page.getByRole("tab", { name: "Today" }).click();
  await expect(page.getByText(/Every 2 h · 3 of \d+ today/)).toBeVisible();
  await page.getByLabel("To-do").last().fill("Stretch");
  await choose(page.getByLabel("Repeat").last(), "Every 2 hours");
  await expect(page.getByLabel("Due date")).toHaveCount(0);
  await expect(page.getByLabel("From")).toHaveValue("09:00");
  await expect(page.getByLabel("Until")).toHaveValue("21:00");
});

test("UC17: a nudge is one switch away", async ({ page }) => {
  await page.getByRole("tab", { name: "Nudges" }).click();
  const stretch = page.getByRole("switch", { name: "Stand up and stretch" });
  await expect(stretch).toHaveAttribute("aria-checked", "false");
  await stretch.click();
  await expect(stretch).toHaveAttribute("aria-checked", "true");
  // Hourly nudges stay off the to-do list.
  await page.getByRole("tab", { name: "Today" }).click();
  await expect(page.locator(".todos")).not.toContainText(
    "Stand up and stretch",
  );
  await page.getByRole("tab", { name: "Nudges" }).click();
  await stretch.click();
  await expect(stretch).toHaveAttribute("aria-checked", "false");
});

test("UC10: a daily habit done today waits for tomorrow", async ({ page }) => {
  await page.getByRole("tab", { name: "Today" }).click();
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

test("UC25: friends show what they're up to and can be sent a bonk", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Friends" }).click();
  await expect(page.locator(".friends__code code")).toHaveText("7KQ2M-XH4PD");
  const friends = page.getByRole("list", { name: "Friends" });
  await expect(friends).toContainText(/Sara\s*Focusing · \d+ min left/);
  await friends
    .getByRole("button", { name: "Bonk with a rolling pin to Sara" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Sent to Sara");
  await page.getByLabel("Friend's code").fill("nope");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".tray__error")).toContainText(
    "doesn't look like a peeps code",
  );
  await page.getByLabel("Friend's code").fill("q7w2e-r4t5y");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(friends).toContainText("A friend");
});

test("UC25: a friend's bonk lands on your peep", async ({ page }) => {
  await page.goto("/?notch=none&reaction=bonk");
  await expect(page.locator(".float__pet .reaction--bonk")).toBeVisible();
  await expect(page.locator(".float__pet .dumpling--dizzy")).toBeVisible();
});

test("UC25: friends focusing keep you company", async ({ page }) => {
  await page.goto("/?notch=none");
  await expect(
    page.getByRole("button", { name: /Focusing too: Sara/ }),
  ).toBeVisible();
});

test("UC8: the pet giggles, gets dizzy, sulks, and loves a hug", async ({
  page,
}) => {
  const pet = page.locator(".panel__head--pet .live-pet");
  await pet.click();
  await pet.click();
  await expect(page.locator(".pet-say")).toHaveText("hehe, stop!");
  for (let i = 0; i < 5; i += 1) await pet.click();
  await expect(page.locator(".pet-say")).toHaveText("hmph!");
  await expect(pet).toHaveAttribute("data-grumpy", "true");
  const box = await pet.boundingBox();
  if (!box) throw new Error("pet not on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await expect(page.locator(".pet-say")).toHaveText("hugs!");
});
