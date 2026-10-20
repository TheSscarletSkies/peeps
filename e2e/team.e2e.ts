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

test("UC21: a product with no team gets a suggested one", async ({ page }) => {
  await page
    .getByRole("button", { name: /^Kaiveni Hiya/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /^Team/ }).click();
  const suggestion = page.getByLabel("Suggested team for Kaiveni Hiya");
  await expect(suggestion).toContainText("Lina, launch marketer");
  await expect(suggestion).toContainText("Gio, growth marketer");
  await suggestion.getByLabel(/Gio, growth marketer/).uncheck();
  await suggestion.getByRole("button", { name: "Add 1 teammate" }).click();
  const team = page.getByRole("list", { name: "Kaiveni Hiya team" });
  await expect(team).toContainText("Lina");
  await expect(team).not.toContainText("Gio");
});

test("UC21: the Team page staffs every empty product at once", async ({
  page,
}) => {
  await page.goto("/?view=home");
  await page.evaluate(() => localStorage.setItem("peeps.tour", "done"));
  await page.reload();
  await page.getByRole("button", { name: /^Team/ }).click();
  for (const [product, name] of [
    ["Funderly", "Sana"],
    ["Enigma Archives", "Remy"],
  ]) {
    const section = page.getByRole("region", {
      name: `${product} team section`,
    });
    await section.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await section.getByRole("button", { name: "Remove" }).click();
  }
  const suggested = page.getByRole("region", { name: "Suggested teams" });
  await expect(suggested).toContainText("Sales co-chair and Growth marketer");
  await expect(suggested).toContainText("Showrunner and Growth marketer");
  await expect(suggested).toContainText("Launch marketer and Growth marketer");
  await suggested.getByRole("button", { name: "Add all suggested" }).click();
  await expect(suggested).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Enigma Archives team" }),
  ).toContainText("Remy");
  await expect(
    page.getByRole("list", { name: "Kaiveni Hiya team" }),
  ).toContainText("Lina");
});
