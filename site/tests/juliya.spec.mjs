import { test, expect } from "@playwright/test";

const snapshot = (page) =>
  page.locator(".doc-content").evaluate((element) => ({
    text: [...element.querySelectorAll("h1, h2, h3, p")].map(
      (node) => node.textContent,
    ),
    links: [...element.querySelectorAll("a")].map((node) => [
      node.textContent,
      node.getAttribute("href"),
    ]),
    code: [...element.querySelectorAll("pre, code")].map(
      (node) => node.textContent,
    ),
    ids: [...element.querySelectorAll("[id]")].map((node) => node.id),
  }));

test("Juliya enhances Korean prose without rewriting documentation", async ({
  browser,
  page,
}, testInfo) => {
  const plain = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  await plain.goto("http://127.0.0.1:4173/boundra/docs/user-guide.ko/");
  const original = await snapshot(plain);
  await plain.close();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("./docs/user-guide.ko/");
  await expect(page.locator(".doc-content h1")).toHaveAttribute(
    "data-juliya",
    "applied",
  );
  await expect(
    page.locator('.doc-content [data-juliya="fallback"]'),
  ).toHaveCount(0);
  await expect
    .poll(() => page.locator('.doc-content [data-juliya="applied"] br').count())
    .toBeGreaterThan(0);
  const countingHeading = page.locator('[id="2-도메인-두-개로-시작하기"]');
  await expect(countingHeading).toHaveAttribute("data-juliya", "applied");
  await expect.poll(() => countingHeading.innerText()).toContain("두 개로");
  expect(await snapshot(page)).toEqual(original);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("korean-320.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  expect(await snapshot(page)).toEqual(original);
  await page.screenshot({
    path: testInfo.outputPath("korean-1440.png"),
    fullPage: true,
  });
});

test("other languages retain native wrapping", async ({ page }) => {
  for (const path of ["", ".ja", ".zh-cn"]) {
    await page.goto(`./docs/user-guide${path}/`);
    await expect(page.locator("[data-juliya]")).toHaveCount(0);
  }
});

test("Korean documentation remains readable when the Juliya module is unavailable", async ({ browser, page }) => {
  const plain = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  await plain.goto("http://127.0.0.1:4173/boundra/docs/user-guide.ko/");
  const original = await snapshot(plain);
  await plain.close();
  await page.setViewportSize({ width: 320, height: 900 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const moduleFailed = page.waitForEvent("requestfailed", request =>
    /\/_astro\/dom\.[^/]+\.js$/.test(new URL(request.url()).pathname),
  );
  await page.route("**/_astro/dom.*.js", route => route.abort());
  await page.goto("./docs/user-guide.ko/");
  await moduleFailed;
  await expect(page.locator("html")).toHaveAttribute("data-juliya", "fallback");
  await expect(page.locator(".doc-content h1")).toBeVisible();
  await expect(page.locator(".doc-content [data-juliya]")).toHaveCount(0);
  expect(await snapshot(page)).toEqual(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
