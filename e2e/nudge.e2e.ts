import { expect, test } from "@playwright/test";

test("UC10: a reminder pops up as a speech bubble from the helper", async ({
  page,
}) => {
  await page.goto("/?nudge=Drink water");
  const reminder = page.getByRole("alert", { name: "Reminder" });
  await expect(reminder).toContainText("Drink water");
  await expect(reminder.locator(".dumpling--wave")).toBeVisible();
  await reminder.getByRole("button", { name: "Done" }).click();
  await expect(reminder).toHaveCount(0);
});

test("UC10: Later puts the reminder away for now", async ({ page }) => {
  await page.goto("/?notch=none&nudge=Stretch");
  const reminder = page.getByRole("alert", { name: "Reminder" });
  await expect(reminder).toContainText("Stretch");
  await reminder.getByRole("button", { name: "Later" }).click();
  await reminder.getByRole("button", { name: "30 min" }).click();
  await expect(reminder).toHaveCount(0);
});

test("UC10: a reminder shows peeps' own drawing, not an emoji, and closes", async ({
  page,
}) => {
  await page.goto("/?notch=none&nudge=Take a break ☕");
  const reminder = page.getByRole("alert", { name: "Reminder" });
  await expect(reminder.locator(".nudge__title")).toHaveText("Take a break");
  await expect(reminder.locator(".nudge__art")).toBeVisible();
  await reminder.getByRole("button", { name: "Close reminder" }).click();
  await expect(reminder).toHaveCount(0);
});

test("UC22: the pet asks to get to know you and starts the chat", async ({
  page,
}) => {
  await page.goto("/?notch=none&action=chat&nudge=Can I get to know you?");
  const reminder = page.getByRole("alert", { name: "Reminder" });
  await reminder.getByRole("button", { name: "Let's chat" }).click();
  await expect(reminder).toHaveCount(0);
  await expect(page.getByText("Get to know me").first()).toBeVisible();
});
