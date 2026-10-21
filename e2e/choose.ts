import type { Locator } from "@playwright/test";

/** Picks an option from one of peeps' own dropdowns, the way a person would. */
export async function choose(dropdown: Locator, option: string | RegExp) {
  await dropdown.click();
  await dropdown
    .page()
    .getByRole("option", { name: option, exact: typeof option === "string" })
    .click();
}
