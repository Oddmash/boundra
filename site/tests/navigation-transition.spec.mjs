import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"]) {
  test(`landing and docs navigation is error-free with motion set to ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        ["warning", "error"].includes(message.type()) &&
        /viewtransition|view transition/i.test(message.text())
      ) {
        errors.push(message.text());
      }
    });

    await page.goto("./");
    await page.locator("header").getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page).toHaveURL(/\/boundra\/docs\/$/);
    await page.getByRole("link", { name: "User guide", exact: true }).first().click();
    await expect(page).toHaveURL(/\/boundra\/docs\/user-guide\/$/);
    expect(errors).toEqual([]);
  });
}
