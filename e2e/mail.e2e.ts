import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("UC19: an email the helper drafted waits in its card to be edited and sent", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Helper/ }).click();
  await expect(page.getByRole("tab", { name: "Mail 1" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const email = page.getByRole("form", {
    name: "Email to sara@brightfund.org",
  });
  await expect(email.getByLabel("From")).toHaveValue("hello@funderly.app");
  await email.getByLabel("Subject").fill("Welcome aboard, Sara");
  await email.getByLabel("From").selectOption("mariyam@icloud.com");
  await expect(
    email.getByText(/app password for mariyam@icloud.com/),
  ).toBeVisible();
  await expect(email.getByRole("button", { name: "Send" })).toBeDisabled();
  await email.getByLabel("From").selectOption("hello@funderly.app");
  await email.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Sent to sara@brightfund.org. I'll tell you when they reply.",
  );
  await expect(email).toHaveCount(0);
});

test("UC19: the Mail page adds accounts, writes email and follows up", async ({
  page,
}) => {
  await page.goto("/?view=home");
  await page.evaluate(() => localStorage.setItem("peeps.tour", "done"));
  await page.reload();
  await page.getByRole("button", { name: /^Mail/ }).click();
  await expect(
    page.getByRole("heading", { name: "Mail", exact: true }),
  ).toBeVisible();

  const accounts = page.getByRole("list", { name: "Mail accounts" });
  await expect(accounts).toContainText(
    "Needs its app password on this computer",
  );
  await accounts.getByRole("button", { name: "Add password" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue(
    "mariyam@icloud.com",
  );
  await expect(page.getByLabel("Provider")).toHaveValue("icloud");

  await page.getByLabel("Email address").fill("hello@kaiveni.com");
  await page.getByLabel("Provider").selectOption("gmail");
  await page.getByLabel("This address lives inside another account").check();
  await expect(
    page.getByRole("button", { name: "Add account" }),
  ).toBeDisabled();
  await page.getByLabel("Account it lives in").fill("mariyam@gmail.com");
  await page
    .getByLabel("App password", { exact: true })
    .fill("abcd efgh ijkl mnop");
  await expect(page.getByRole("button", { name: "Add account" })).toBeEnabled();

  await page.getByRole("button", { name: "New email" }).click();
  const compose = page.getByRole("form", { name: "New email" });
  await compose.getByLabel("To").fill("press@example.com");
  await compose.getByLabel("Subject").fill("Kaiveni Hiya launch");
  await compose.getByLabel("Message").fill("Hi! We launch next week.");
  await compose.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent to press@example.com.")).toBeVisible();
  await expect(compose).toHaveCount(0);

  const waiting = page.getByRole("list", { name: "Waiting for a reply" });
  await expect(waiting).toContainText("tom@greenhope.org");
  await waiting.getByRole("button", { name: "Follow up" }).click();
  await expect(waiting.getByRole("button", { name: "Asked" })).toBeDisabled();
});
