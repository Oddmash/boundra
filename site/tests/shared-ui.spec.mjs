import {test, expect} from "@playwright/test";

test("shared static primitives preserve native landing and documentation links", async ({browser}) => {
  const page = await browser.newPage({javaScriptEnabled: false, viewport: {width: 390, height: 800}});
  try {
    await page.goto("http://127.0.0.1:4173/boundra/ko/");
    await expect(page.locator("header.om-site-header nav.om-site-nav")).toBeVisible();
    await expect(page.locator("footer.om-site-footer nav.om-site-nav")).toBeVisible();
    await expect(page.locator("header .om-platform-link")).toHaveCount(0);
    await expect(page.locator("footer .om-platform-link[data-platform='github']")).toHaveAttribute("href", "https://github.com/Oddmash/boundra");
    await expect(page.locator("footer .om-platform-link[data-platform='npm']")).toHaveAttribute("href", "https://www.npmjs.com/package/boundra");
    await expect(page.locator("footer .om-platform-link")).toHaveCount(2);
    await expect(page.locator(".om-button.om-button--link").first()).toBeVisible();
    await expect(page.locator(".doc-list > a.om-link-card").first()).toBeVisible();
    await expect(page.locator(".om-code-block pre.om-code-block-content").first()).toBeVisible();
    await expect(page.locator("[data-language-fallback]")).toBeVisible();
    await page.goto("http://127.0.0.1:4173/boundra/docs/user-guide.ko/");
    await expect(page.locator("header .om-platform-link")).toHaveCount(0);
    await expect(page.locator("footer .om-platform-link")).toHaveCount(2);
    await expect(page.locator("article.om-prose")).toBeVisible();
    await expect(page.locator("article.om-prose pre code").first()).toBeVisible();
    await expect(page.locator("article.om-prose .om-clipboard-button")).toHaveCount(0);
    await page.locator(".mobile-docs-nav summary").click();
    await expect(page.locator(".mobile-docs-nav .om-docs-navigation .om-docs-links a").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await page.close();
  }
});

test("platform hover and reduced motion use shared UI CSS", async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("ko/");
  const github = page.locator("footer .om-platform-link[data-platform='github']");
  const npm = page.locator("footer .om-platform-link[data-platform='npm']");
  await expect(page.locator("header .om-platform-link")).toHaveCount(0);
  await npm.hover();
  await expect(npm).toHaveCSS("color", "rgb(203, 56, 55)");
  await expect(npm.locator("svg")).toHaveCSS("animation-name", "om-platform-pulse");
  await github.hover();
  await expect(github.locator("svg")).toHaveCSS("animation-name", "om-platform-pulse");
  await page.emulateMedia({reducedMotion: "reduce"});
  await expect(github.locator("svg")).toHaveCSS("animation-name", "none");
});

test("the shared heading observer marks the visible documentation section", async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto("docs/user-guide/");
  const links = page.locator(".docs-toc .om-toc-links a");
  const last = links.last();
  await expect(last).toHaveAttribute("href", /^#/);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const active = page.locator(".docs-toc [aria-current='location']");
  await expect(active).toHaveCount(1);
  const expected = await links.evaluateAll(items => items.map(link => {
    const heading = document.getElementById(link.dataset.headingId);
    return {
      id: link.dataset.headingId,
      top: heading.getBoundingClientRect().top,
      readingLine: Math.max(96, Number.parseFloat(getComputedStyle(heading).scrollMarginTop) || 0) + 24,
    };
  }).filter(heading => heading.top <= heading.readingLine).at(-1)?.id);
  expect(expected).toBeTruthy();
  await expect(active).toHaveAttribute("data-heading-id", expected);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(last).not.toHaveAttribute("aria-current", "location");
});
