import { test, expect } from "@playwright/test";

test("static landing and documentation reuse semantic UI primitives", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto("ko/");
    await expect(page.locator("header.om-site-header nav.om-site-nav")).toBeVisible();
    await expect(page.locator("footer.om-site-footer nav.om-site-nav")).toBeVisible();
    await expect(page.locator(".om-link-card").first()).toBeVisible();
    await expect(page.locator(".om-code-block pre.om-code-block-content").first()).toBeVisible();
    await expect(page.locator("[data-language-fallback]")).toBeVisible();
    await page.goto("docs/user-guide.ko/");
    await expect(page.locator("article.om-prose")).toBeVisible();
    await expect(page.locator("article.om-prose pre code").first()).toBeVisible();
    await expect(page.locator("article.om-prose .om-code-block-copy")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
  }
});

test("enhanced documentation preserves complete code and shares copy control styles", async ({ page }) => {
  await page.goto("docs/user-guide/");
  const block = page.locator("article.om-prose .om-code-block").first();
  await expect(block.locator("pre.om-code-block-content code")).not.toBeEmpty();
  await expect(block.getByRole("button", { name: "Copy code" })).toHaveClass(/om-code-block-copy/);
  await expect(block.locator("pre.om-code-block-content")).toHaveCSS("white-space", "pre");
});
