import { test, expect } from "@playwright/test";

for (const [locale, lang, choice] of [
  ["ko", "ko", "한국어"],
  ["ja", "ja", "日本語"],
  ["zh-cn", "zh-CN", "简体中文"],
]) {
  test(`complete reference index and same-page language switch: ${locale}`, async ({ page }) => {
    await page.goto("docs/");
    const english = await page.locator(".reference-list a").evaluateAll(links =>
      links.map(link => link.getAttribute("href")));
    expect(english.length).toBeGreaterThan(15);
    const expected = english.map(href =>
      href.endsWith("/example/") ? href.replace("/docs/", `/docs/${locale}/`) :
        href.replace(/\/$/, `.${locale}/`));
    await page.goto(`docs/${locale}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    const actual = await page.locator(".reference-list a").evaluateAll(links =>
      links.map(link => link.getAttribute("href")));
    expect(actual).toEqual(expected);
    const reference = page.locator(`.reference-list a[href="/boundra/docs/boundary-rules.${locale}/"]`);
    await reference.click();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("article h1")).toBeVisible();
    await expect(page.locator("article")).toContainText("BR-006");
    await page.locator(".language-select [role=combobox]").click();
    await page.getByRole("option", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/boundary-rules\/$/);
    await page.locator(".language-select [role=combobox]").click();
    await page.getByRole("option", { name: choice, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/docs/boundary-rules\\.${locale}/$`));
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
  });
}
