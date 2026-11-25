import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`scroll-aware header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("docs/user-guide.ko/");
    const header = page.locator(".site-header");
    const docsLink = header.locator(".docs-header-link");
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect(docsLink).toHaveAttribute("aria-current", "page");
    await expect(docsLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(docsLink).toHaveCSS("border-bottom-color", "rgb(194, 65, 12)");
    await expect(header).toHaveCSS("transition-duration", "0s");

    const mainOffset = await page.locator("main").evaluate(element => element.offsetTop);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).toHaveAttribute("data-scroll-hidden", "true");
    await expect.poll(() => header.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    await page.evaluate(() => window.scrollBy(0, -12));
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect.poll(() => header.evaluate(element => element.getBoundingClientRect().top)).toBe(0);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(await page.locator("main").evaluate(element => element.offsetTop)).toBe(mainOffset);

    await page.evaluate(() => window.scrollBy(0, 80));
    await expect(header).toHaveAttribute("data-scroll-hidden", "true");
    await docsLink.focus();
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect(docsLink).toBeFocused();
    await page.evaluate(() => window.scrollBy(0, 80));
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  });
}
