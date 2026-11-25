import { test, expect } from "@playwright/test";

const readReflow = (page) =>
  page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll("main *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (
            ["auto", "scroll"].includes(getComputedStyle(parent).overflowX) &&
            parent.scrollWidth > parent.clientWidth
          )
            return false;
        }
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      })
      .map((element) => `${element.tagName}.${element.className}`)
      .slice(0, 12),
  }));

const assertReflow = async (page) => {
  const reflow = await readReflow(page);
  expect(reflow.document, JSON.stringify(reflow)).toBeLessThanOrEqual(
    reflow.viewport,
  );
  expect(reflow.overflowing, JSON.stringify(reflow)).toEqual([]);
};

test("reflow diagnostics detect content clipped on the left", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("./");
  await page.locator("main").evaluate((main) => {
    const element = document.createElement("div");
    element.className = "left-reflow-fixture";
    Object.assign(element.style, {
      position: "absolute",
      left: "-30px",
      width: "100px",
      height: "20px",
    });
    main.append(element);
  });
  expect((await readReflow(page)).overflowing).toContain(
    "DIV.left-reflow-fixture",
  );
});

test("documentation images resolve to published docs assets", async ({
  page,
}) => {
  await page.goto("./docs/brand/");
  const mark = page.getByRole("img", { name: "Boundra mark" });
  await expect(mark).toHaveAttribute(
    "src",
    "/boundra/docs/assets/boundra-mark.svg",
  );
  expect(
    await mark.evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
});

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
    const blocked = page.getByRole("radio", { name: "Internal import" });
    const allowed = page.getByRole("radio", { name: "Public API" });
    await expect(blocked).toBeChecked();
    await blocked.focus();
    await blocked.press("ArrowRight");
    await expect(allowed).toBeChecked();
    await expect(page.getByText("Allowed by boundary rules", { exact: true })).toBeVisible();
    await expect(page.getByText("BR-004", { exact: true })).toBeHidden();
    await assertReflow(page);
    await page.screenshot({ path: testInfo.outputPath("allowed-import.png"), fullPage: true });
    await allowed.press("ArrowLeft");
    await expect(blocked).toBeChecked();
    await expect(page.getByText("BR-004", { exact: true })).toBeVisible();
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
