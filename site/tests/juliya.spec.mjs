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
    codeMarkup: [...element.querySelectorAll("code")].map(
      (node) => node.innerHTML,
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
  await expect(page.locator(".doc-content h1")).toHaveAttribute(
    "data-juliya-locale",
    "ko",
  );
  await expect(page.locator(".doc-content h1")).toHaveAttribute(
    "data-juliya-strategy",
    "balanced",
  );
  const introduction = page.locator(".doc-content p").filter({
    hasText: "Boundra는 Rust 기반 소스 아키텍처 검사기",
  });
  await expect(introduction).toHaveAttribute("data-juliya", "applied");
  await expect(introduction).toHaveAttribute("data-juliya-strategy", "greedy");
  await expect(page.locator(".doc-content p[data-juliya]:has(code)")).toHaveCount(0);
  await expect(page.locator(".doc-content code br[data-kowrap-break]")).toHaveCount(0);
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

for (const [path, locale, introductionText, strategy] of [
  ["", "en", "Boundra combines a Rust source architecture checker", "greedy"],
  [".ja", "ja", "Boundra は Rust によるソースアーキテクチャ", "balanced"],
  [".zh-cn", "zh", "Boundra 将 Rust 源代码架构检查器", "balanced"],
]) {
  test(`Juliya enhances ${locale} prose while preserving source and markup`, async ({ browser, page }) => {
    const route = `./docs/user-guide${path}/`;
    const plain = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 },
    });
    await plain.goto(`http://127.0.0.1:4173/boundra/docs/user-guide${path}/`);
    const original = await snapshot(plain);
    await plain.close();

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(route);
    const heading = page.locator(".doc-content h1");
    await expect(heading).toHaveAttribute("data-juliya", "applied");
    await expect(heading).toHaveAttribute("data-juliya-locale", locale);
    await expect(heading).toHaveAttribute("data-juliya-strategy", "balanced");
    const introduction = page.locator(".doc-content p").filter({ hasText: introductionText });
    await expect(introduction).toHaveAttribute("data-juliya", "applied");
    await expect(introduction).toHaveAttribute("data-juliya-locale", locale);
    await expect(introduction).toHaveAttribute("data-juliya-strategy", strategy);
    if (locale === "en") expect((await introduction.textContent()).length).toBeGreaterThan(160);
    await expect(introduction).toHaveCSS("text-wrap-mode", "wrap");
    await expect.poll(() => introduction.locator("br[data-kowrap-break]").count()).toBeGreaterThan(0);

    await expect(page.locator('.doc-content [data-juliya="fallback"]')).toHaveCount(0);
    await expect(page.locator(".doc-content p[data-juliya]:has(code)")).toHaveCount(0);
    await expect(page.locator(".doc-content code br[data-kowrap-break]")).toHaveCount(0);
    expect(await snapshot(page)).toEqual(original);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const link = page.locator(".doc-content p[data-juliya='applied'] a[href]").first();
    await expect(link).toBeVisible();
    const originalLink = await link.elementHandle();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => introduction.locator("br[data-kowrap-break]").count()).toBeLessThan(4);
    expect(await link.evaluate((element, previous) => element === previous, originalLink)).toBe(true);
    await originalLink.dispose();
    expect(await snapshot(page)).toEqual(original);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

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
