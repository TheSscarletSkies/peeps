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
  await expect(reminder).toHaveCount(0);
});
