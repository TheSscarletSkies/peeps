import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .getByRole("button", { name: /^Funderly/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /^Team/ }).click();
});

test("UC21: a teammate's shift report shows on its product's card", async ({
  page,
}) => {
  const team = page.getByRole("list", { name: "Funderly team" });
  await expect(team).toContainText("Sales co-chair");
  await team.getByRole("button", { name: /^Sana/ }).click();
  const report = page.locator(".chat__message").first();
  await expect(report.locator("strong").first()).toHaveText("Done");
  await expect(report).not.toContainText("**");
  await expect(page.getByLabel("Message Sana")).toBeVisible();

  const rhythm = page.getByRole("switch", { name: "Sana works on a rhythm" });
  await expect(rhythm).toHaveAttribute("aria-checked", "true");
  await rhythm.click();
  await expect(rhythm).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Paused")).toBeVisible();
  await rhythm.click();
  await expect(rhythm).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Playbook" }).click();
  const playbook = page.getByLabel("Sana playbook");
  await expect(playbook).toHaveValue(/Revenue/);
  await playbook.fill("## What I own\n\nOnly annual plans.");
  await page.getByRole("button", { name: "Save playbook" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
});

test("UC21: a new teammate starts from a role", async ({ page }) => {
  await page.getByRole("button", { name: "Add a teammate" }).click();
  const add = page.getByRole("form", { name: "Add a teammate to Funderly" });
  await add.getByRole("radio", { name: /Growth marketer/ }).click();
  await add.getByLabel("Name").fill("Gigi");
  await add.getByRole("button", { name: "Add Gigi" }).click();
  await expect(
    page.getByRole("switch", { name: "Gigi works on a rhythm" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "← Team" }).click();
  await expect(page.getByRole("list", { name: "Funderly team" })).toContainText(
    "Gigi",
  );
  await page.getByRole("tab", { name: "Team 2" }).isVisible();
});
