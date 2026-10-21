import { expect, test } from "@playwright/test";

test("UC17: a product pet can be asked for strategy and keeps a brief", async ({
  page,
}) => {
  await page.goto("/?view=home");
  await page.evaluate(() => localStorage.setItem("peeps.tour", "done"));
  await page.reload();

  await page.getByRole("button", { name: "Ask Funderly · Brief" }).click();
  const panel = page.locator(".product-focus");
  await panel.getByRole("tab", { name: "Ask" }).click();
  await expect(
    panel.getByRole("switch", { name: "Weekly review for Funderly" }),
  ).toHaveText("Off");
  await expect(panel.getByText("Where are we losing people?")).toBeVisible();
  await panel
    .getByLabel("Message Funderly")
    .fill("What should I focus on this week?");
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel.getByText("In the app I'd ask your agent")).toBeVisible();

  await panel.getByRole("tab", { name: "Brief" }).click();
  const brief = panel.getByLabel("Funderly brief");
  await expect(brief).toHaveValue(/## Goal/);
  await brief.fill("# Funderly\n\n## Goal\n\n100 paying teams by March");
  await panel.getByRole("button", { name: "Save brief" }).click();
  await expect(panel.getByRole("button", { name: "Saved" })).toBeDisabled();
  await panel.getByRole("tab", { name: "Note" }).click();
  await panel.getByRole("tab", { name: "Brief" }).click();
  await expect(panel.getByLabel("Funderly brief")).toHaveValue(
    /100 paying teams/,
  );
});

test("UC17: the notch card has the same tabs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Enigma Archives/ }).click();
  await page.getByRole("tab", { name: "Ask" }).click();
  await expect(
    page.getByText("Think it through with Enigma Archives"),
  ).toBeVisible();
});

test("UC1: removing a product sits in its ⋯ menu and asks first", async ({
  page,
}) => {
  await page.goto("/?view=home");
  await page.evaluate(() => localStorage.setItem("peeps.tour", "done"));
  await page.reload();
  await page.getByRole("button", { name: /^Products/ }).click();
  await page.getByRole("button", { name: "More for Funderly" }).click();
  const menu = page.getByRole("menu");
  await expect(
    menu.getByRole("menuitem", { name: "Add this computer's folder" }),
  ).toBeVisible();
  await menu.getByRole("menuitem", { name: "Remove…" }).click();
  await expect(menu).toContainText("Its pet goes; your project stays.");
  await menu.getByRole("menuitem", { name: "Cancel" }).click();
  await expect(menu.getByRole("menuitem", { name: "Remove…" })).toBeVisible();
});

test("UC14: setup is a slim bar with the next step", async ({ page }) => {
  await page.goto("/?view=home");
  await page.evaluate(() => localStorage.setItem("peeps.tour", "done"));
  await page.reload();
  const guide = page.getByRole("region", { name: "Getting started" });
  await expect(guide.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "3",
  );
  await expect(guide).toContainText("Next: Connect Claude Code");
  await guide.getByRole("button", { name: "Show all" }).click();
  await expect(guide.locator("li")).toHaveCount(5);
});
