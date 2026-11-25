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
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-active=true] .rule")).toHaveText("BR-001");
    await page.screenshot({
      path: testInfo.outputPath("landing.png"),
      fullPage: true,
    });
    await assertReflow(page);
    const next = page.getByRole("button", { name: "Next example" });
    await expect(page.getByRole("button", { name: "Pause animation" })).toBeHidden();
    for (const rule of ["BR-004", "BR-006", "PASS"]) {
      await next.press("Enter");
      await expect(page.locator("[data-active=true] .rule")).toHaveText(rule);
      await assertReflow(page);
    }
    await expect(page.getByText("Allowed by boundary rules", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("allowed-import.png"), fullPage: true });
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

test("automatic boundary sequence pauses and supports explicit inspection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const rule = page.locator("[data-active=true] .rule");
  await expect(rule).toHaveText("BR-001");
  await expect(rule).toHaveText("BR-004", { timeout: 8000 });
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(page.getByRole("button", { name: "Resume animation" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.locator("h1").click();
  await page.waitForTimeout(5500);
  await expect(rule).toHaveText("BR-004");
  await page.getByRole("button", { name: "Next example" }).click();
  await expect(rule).toHaveText("BR-006");
  await page.getByRole("button", { name: "Resume animation" }).click();
  await page.locator("#quickstart").scrollIntoViewIfNeeded();
  await page.locator("#quickstart h2").click();
  await page.mouse.move(0,0);
  await page.waitForTimeout(5500);
  await expect(rule).toHaveText("BR-006");
});

for (const [route, lang, name, start, suffix] of [
  ["ko/", "ko", "한국어", "시작하기", "ko"],
  ["ja/", "ja", "日本語", "始める", "ja"],
  ["zh-cn/", "zh-CN", "简体中文", "开始使用", "zh-cn"],
]) {
  for (const width of [320, 1440]) {
    test(`localized ${lang} landing at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('link[rel=alternate][hreflang="en"]')).toHaveCount(1);
      await assertReflow(page);
      await page.screenshot({ path: testInfo.outputPath("localized-landing.png"), fullPage: true });
      await page.locator(".locale-menu summary").click();
      await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: "English", exact: true })).toBeVisible();
      await page.locator(".locale-menu summary").click();
      await page.getByRole("link", { name: start, exact: true }).click();
      await expect(page).toHaveURL(new RegExp("user-guide\\." + suffix + "/$"));
      await assertReflow(page);
    });
  }
}
