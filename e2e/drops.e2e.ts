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

test("UC4: a document dropped on the helper is eaten and asked about", async ({
  page,
}) => {
  await page.goto("/?notch=none");
  await dropFile(page, ".float__pet", "syllabus.pdf");
  await expect(page.getByText(/I just fed you this/)).toBeVisible();
  await expect(page.getByText(/syllabus\.pdf/).first()).toBeVisible();
});
