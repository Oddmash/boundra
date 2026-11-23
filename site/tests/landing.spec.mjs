import { test, expect } from "@playwright/test";

const assertReflow = async (page) => {
  const reflow = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll("main *")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > innerWidth &&
          getComputedStyle(element).overflowX !== "auto",
      )
      .map((element) => `${element.tagName}.${element.className}`)
      .slice(0, 12),
  }));
  expect(reflow.document, JSON.stringify(reflow)).toBeLessThanOrEqual(
    reflow.viewport,
  );
};

for (const width of [1440, 768, 390, 320]) {
  test(`landing and documentation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("BR-004", { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("landing.png"),
      fullPage: true,
    });
    await assertReflow(page);
    expect(
      await page.evaluate(() =>
        [...document.images].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/docs\/user-guide\/$/);
    await expect(
      page.getByRole("heading", { name: "Boundra user guide" }),
    ).toBeVisible();
    await assertReflow(page);
    await page.screenshot({
      path: testInfo.outputPath("documentation.png"),
      fullPage: true,
    });
    if (width <= 720) {
      await page.locator(".mobile-docs-nav summary").click();
    }
    await page
      .getByRole("link", { name: "한국어", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/docs\/user-guide\.ko\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await assertReflow(page);
    expect(errors).toEqual([]);
  });
}
