import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"]) {
  test(`landing and docs navigation is error-free with motion set to ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      window.addEventListener("pagereveal", async (event) => {
        window.boundraNavigationTransition = await (
          event.viewTransition?.ready.then(() => "ready", () => "skipped") ?? "absent"
        );
      }, { once: true });
    });
    const expectedTransition = reducedMotion === "no-preference" ? "ready" : "absent";
    const transitionStarted = () => page.evaluate(() => window.boundraNavigationTransition);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        ["warning", "error"].includes(message.type()) &&
        /view[- ]?transition/i.test(message.text())
      ) {
        errors.push(message.text());
      }
    });

    await page.goto("./");
    await page.locator("header").getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page).toHaveURL(/\/boundra\/docs\/$/);
    await expect.poll(transitionStarted).toBe(expectedTransition);
    await page.getByRole("link", { name: "User guide", exact: true }).first().click();
    await expect(page).toHaveURL(/\/boundra\/docs\/user-guide\/$/);
    await expect.poll(transitionStarted).toBe(expectedTransition);
    await page.locator("header").getByRole("link", { name: "Boundra", exact: true }).click();
    await expect(page).toHaveURL(/\/boundra\/$/);
    await expect.poll(transitionStarted).toBe(expectedTransition);
    expect(errors).toEqual([]);
  });
}
