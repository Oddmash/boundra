import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`scroll-aware header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("docs/user-guide.ko/");
    const header = page.locator(".site-header");
    const docsLink = header.locator(".docs-header-link");
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect(header).toHaveAttribute("data-header-theme", "light");
    await expect(header).toHaveAttribute("data-om-theme", "light");
    await expect(header).toHaveCSS("background-color", "rgb(255, 255, 255)");
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

const themeBoundary = page => page.evaluate(() => {
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero-band");
  return hero.getBoundingClientRect().bottom + scrollY - Math.min(header.offsetHeight, innerHeight) / 2;
});

const assertPalette = async (header, theme) => {
  await expect(header).toHaveAttribute("data-header-theme", theme);
  await expect(header).toHaveAttribute("data-om-theme", theme);
  const dark = theme === "dark";
  await expect(header).toHaveCSS("background-color", dark ? "rgb(17, 17, 16)" : "rgb(255, 255, 255)");
  await expect(header.locator(".brand")).toHaveCSS("color", dark ? "rgb(244, 242, 237)" : "rgb(23, 23, 23)");
  await expect(header.locator(".docs-header-link")).toHaveCSS("color", dark ? "rgb(244, 242, 237)" : "rgb(23, 23, 23)");
  await expect(header.locator("[data-language-picker] [role=combobox]")).toHaveCSS("color", dark ? "rgb(245, 245, 245)" : "rgb(23, 23, 23)");
  const iconContrast = await header.evaluate(element => {
    const rgb = color => color.match(/[\\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const background = luminance(getComputedStyle(element).backgroundColor);
    return [...element.querySelectorAll("a[data-platform]")].map(link => {
      const foreground = luminance(getComputedStyle(link).color);
      return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
    });
  });
  expect(iconContrast).toHaveLength(2);
  expect(iconContrast.every(value => value >= 3)).toBe(true);
};

for (const [width, route] of [[1440, "./"], [390, "ko/"]]) {
  test(`landing header follows the hero boundary at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    const header = page.locator(".site-header");
    await expect(header.locator("[data-language-picker] [role=combobox]")).toBeVisible();
    await page.mouse.move(0, 0);
    await assertPalette(header, "dark");
    const mainOffset = await page.locator("main").evaluate(element => element.offsetTop);
    const boundary = await themeBoundary(page);

    await page.evaluate(y => window.scrollTo(0, y), boundary - 48);
    await expect(header).toHaveAttribute("data-scroll-hidden", "true");
    await assertPalette(header, "dark");
    await page.evaluate(y => window.scrollTo(0, y), boundary + 48);
    await expect(header).toHaveAttribute("data-scroll-hidden", "true");
    await assertPalette(header, "light");

    await page.evaluate(() => window.scrollBy(0, -12));
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect.poll(() => header.evaluate(element => element.getBoundingClientRect().top)).toBe(0);
    await assertPalette(header, "light");
    await page.screenshot({ path: testInfo.outputPath("light-header.png") });

    await page.evaluate(y => window.scrollTo(0, y), boundary - 48);
    await assertPalette(header, "dark");
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await page.screenshot({ path: testInfo.outputPath("dark-header.png") });
    expect(await page.locator("main").evaluate(element => element.offsetTop)).toBe(mainOffset);
    await expect(header).toHaveCSS("transition-duration", "0s");

    const docsLink = header.locator(".docs-header-link");
    await page.keyboard.press("Tab");
    await docsLink.focus();
    await expect(docsLink).toBeFocused();
    await expect(docsLink).toHaveCSS("outline-color", "rgb(255, 191, 145)");
    await page.evaluate(y => window.scrollTo(0, y), boundary + 48);
    await assertPalette(header, "light");
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect(docsLink).toHaveCSS("outline-color", "rgb(194, 65, 12)");
  });
}

test("palette changes do not interpolate foreground across the opposite surface", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    window.headerThemes = [];
    new MutationObserver(records => {
      for (const { target } of records) {
        if (!(target instanceof HTMLElement) || !target.classList.contains("site-header")) continue;
        window.headerThemes.push({
          theme: target.dataset.headerTheme,
          background: getComputedStyle(target).backgroundColor,
          title: getComputedStyle(target.querySelector(".brand")).color,
          link: getComputedStyle(target.querySelector(".docs-header-link")).color,
        });
      }
    }).observe(document, { subtree: true, attributeFilter: ["data-header-theme"] });
  });
  await page.goto("./");
  const header = page.locator(".site-header");
  await expect(header.locator("[data-language-picker] [role=combobox]")).toBeVisible();
  const boundary = await themeBoundary(page);
  await page.evaluate(y => window.scrollTo(0, y), boundary + 48);
  await expect(header).toHaveAttribute("data-header-theme", "light");
  await page.evaluate(y => window.scrollTo(0, y), boundary - 48);
  await expect(header).toHaveAttribute("data-header-theme", "dark");
  const themes = await page.evaluate(() => window.headerThemes);
  expect(themes).toEqual([
    { theme: "light", background: "rgb(255, 255, 255)", title: "rgb(23, 23, 23)", link: "rgb(23, 23, 23)" },
    { theme: "dark", background: "rgb(17, 17, 16)", title: "rgb(244, 242, 237)", link: "rgb(244, 242, 237)" },
  ]);
});

test("header tone updates when responsive hero geometry changes and the page is restored", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const header = page.locator(".site-header");
  await expect(header.locator("[data-language-picker] [role=combobox]")).toBeVisible();
  await page.evaluate(() => document.documentElement.style.overflowAnchor = "none");
  const boundary = await themeBoundary(page);
  await page.evaluate(y => window.scrollTo(0, y), boundary + 48);
  await assertPalette(header, "light");
  await page.setViewportSize({ width: 390, height: 800 });
  await expect.poll(() => themeBoundary(page)).toBeGreaterThan(boundary + 48);
  await assertPalette(header, "dark");

  await page.setViewportSize({ width: 1440, height: 800 });
  await assertPalette(header, "light");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  await assertPalette(header, "light");
});

test("native language fallback uses the same header palette if enhancement is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("ko/");
  const header = page.locator(".site-header");
  await expect(header.locator("[data-language-picker] [role=combobox]")).toBeVisible();
  await page.evaluate(() => {
    document.querySelector("[data-language-picker]").hidden = true;
    document.querySelector("[data-language-fallback]").hidden = false;
  });
  const fallback = header.locator("[data-language-fallback]");
  await fallback.locator("summary").click();
  await expect(fallback).toHaveAttribute("open", "");
  const menu = fallback.locator(".locale-options");
  await expect(menu).toHaveCSS("background-color", "rgb(34, 32, 30)");
  await expect(menu.getByRole("link", { name: "English" })).toHaveCSS("color", "rgb(244, 242, 237)");
  const boundary = await themeBoundary(page);
  await page.evaluate(y => window.scrollTo(0, y), boundary + 48);
  await expect(header).toHaveAttribute("data-header-theme", "light");
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  await expect(menu).toHaveCSS("background-color", "rgb(250, 250, 249)");
  await expect(menu.getByRole("link", { name: "English" })).toHaveCSS("color", "rgb(23, 23, 23)");
});
