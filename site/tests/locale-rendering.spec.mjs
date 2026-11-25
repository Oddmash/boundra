import { expect, test } from "@playwright/test";

const locales = [
  ["./", "en", "English"],
  ["./ko/", "ko", "한국어"],
  ["./ja/", "ja", "日本語"],
  ["./zh-cn/", "zh-CN", "简体中文"],
];

const geometry = (page, selector) => page.evaluate(selector => {
  const header = document.querySelector(".site-header").getBoundingClientRect();
  const control = document.querySelector(selector).getBoundingClientRect();
  const hero = document.querySelector(".hero-band").getBoundingClientRect();
  return {
    headerHeight: header.height,
    controlWidth: control.width,
    controlHeight: control.height,
    controlLeft: control.left,
    controlTop: control.top,
    heroTop: hero.top,
  };
}, selector);

const holdScripts = async page => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pattern = "**/_astro/*.js";
  const handler = async route => {
    await gate;
    await route.continue();
  };
  await page.route(pattern, handler);
  return {
    release,
    cleanup: () => page.unroute(pattern, handler),
  };
};

for (const width of [320, 1440]) {
  test(`localized first paint keeps picker and hero geometry stable at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    for (const [route, lang, name] of locales) {
      const scripts = await holdScripts(page);
      let before;
      try {
        await page.goto(route, { waitUntil: "commit" });
        const fallback = page.locator("[data-language-fallback]");
        await expect(fallback).toBeVisible();
        await expect(fallback.locator("summary")).toHaveText(name);
        await expect(fallback).toHaveCSS("height", "38px");
        await expect(page.locator(".boundary-stage")).toHaveAttribute("data-phase", "result");
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("html")).toHaveCSS("background-color", "rgb(17, 17, 16)");
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(17, 17, 16)");
        await expect(page.locator("main")).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await expect(page.locator(".hero-band")).toHaveCSS("background-color", "rgb(17, 17, 16)");
        await page.evaluate(() => document.fonts.ready);
        before = await geometry(page, "[data-language-fallback]");
      } finally {
        scripts.release();
      }

      const picker = page.locator("[data-language-picker]");
      await expect(picker).toBeVisible();
      await expect(picker.getByRole("combobox")).toHaveText(name);
      await expect(page.locator("[data-language-fallback]")).toBeHidden();
      await expect(page.locator(".boundary-stage")).toHaveAttribute("data-ready", "true");
      await expect(page.locator(".boundary-stage")).toHaveAttribute("data-phase", "result");
      const after = await geometry(page, "[data-language-picker]");
      for (const key of Object.keys(before)) {
        expect(Math.abs(after[key] - before[key]), `${lang} ${width}px ${key}: ${JSON.stringify({ before, after })}`).toBeLessThan(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.waitForLoadState("domcontentloaded");
      await scripts.cleanup();
    }
  });
}

test("an open or focused native language menu remains usable during deferred enhancement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const scripts = await holdScripts(page);
  const fallback = page.locator("[data-language-fallback]");
  try {
    await page.goto("./", { waitUntil: "commit" });
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveCSS("height", "38px");
    const before = await geometry(page, "[data-language-fallback]");
    await fallback.locator("summary").click();
    await expect(fallback).toHaveAttribute("open", "");
    await expect(fallback.getByRole("link", { name: "한국어" })).toBeVisible();
    expect((await geometry(page, "[data-language-fallback]")).headerHeight).toBe(before.headerHeight);
  } finally {
    scripts.release();
  }
  await page.waitForLoadState("domcontentloaded");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("open", "");
  await expect(page.locator("[data-language-picker]")).toBeHidden();
  await scripts.cleanup();
  await fallback.getByRole("link", { name: "한국어" }).click();
  await expect(page).toHaveURL(/\/ko\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator("[data-language-picker]")).toBeVisible();
});

test("all locale selections and browser history retain full semantic routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  for (const [route, lang, name] of [...locales.slice(1), locales[0]]) {
    await page.locator("[data-language-picker] [role=combobox]").click();
    await page.getByRole("option", { name, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", new RegExp("/boundra/" + route.slice(2) + "$"));
    await expect(page.locator(".boundary-stage")).toHaveAttribute("data-phase", "result");
    await expect(page.locator(".boundary-stage")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("[data-language-picker] [role=combobox]")).toHaveText(name);
    await expect(page.locator("[data-language-fallback]")).toBeHidden();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/zh-cn\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator(".boundary-stage")).toHaveAttribute("data-phase", "result");
});

test("native alternate links and completed hero remain available without JavaScript", async ({ browser }) => {
  const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  try {
    await plain.goto("http://127.0.0.1:4173/boundra/");
    for (const [, lang, name] of [...locales.slice(1), locales[0]]) {
      await plain.locator("[data-language-fallback] summary").click();
      await plain.getByRole("link", { name, exact: true }).click();
      await expect(plain.locator("html")).toHaveAttribute("lang", lang);
      await expect(plain.locator("[data-language-fallback]")).toBeVisible();
      await expect(plain.locator("[data-language-picker]")).toBeHidden();
      await expect(plain.locator(".boundary-stage")).toHaveAttribute("data-phase", "result");
      await expect(plain.locator("[data-active=true] .rule")).toHaveText("BR-001");
      expect(await plain.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally {
    await plain.close();
  }
});
