import { expect, test, type Page } from "@playwright/test";

async function dropFile(page: Page, target: string, name: string) {
  const box = await page.locator(target).boundingBox();
  if (!box) throw new Error(`${target} not on screen`);
  await page.evaluate(
    ({ x, y, name }) => {
      const data = new DataTransfer();
      data.items.add(new File(["hello"], name));
      window.dispatchEvent(
        new DragEvent("drop", {
          clientX: x,
          clientY: y,
          dataTransfer: data,
          cancelable: true,
        }),
      );
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2, name },
  );
}

test("UC4: a file dropped on a product pet waits in its note", async ({
  page,
}) => {
  await page.goto("/");
  await dropFile(page, '[data-drop="kaiveni-hiya"]', "launch-plan.pdf");
  await expect(
    page.getByRole("list", { name: "Attached files" }),
  ).toContainText("launch-plan.pdf");
  await expect(page.getByRole("button", { name: "Feed" })).toBeEnabled();
});

test("UC4: a file dropped on the helper joins the next message", async ({
  page,
}) => {
  await page.goto("/?notch=none");
  await dropFile(page, ".float__pet", "receipt.png");
  await expect(
    page.getByRole("list", { name: "Attached files" }),
  ).toContainText("receipt.png");
});
