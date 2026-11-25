import { test, expect } from "@playwright/test";

const readReflow = (page) =>
  page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll("main *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (
            ["auto", "scroll"].includes(getComputedStyle(parent).overflowX) &&
            parent.scrollWidth > parent.clientWidth
          )
            return false;
        }
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      })
      .map((element) => `${element.tagName}.${element.className}`)
      .slice(0, 12),
  }));

const assertReflow = async (page) => {
  const reflow = await readReflow(page);
  expect(reflow.document, JSON.stringify(reflow)).toBeLessThanOrEqual(
    reflow.viewport,
  );
  expect(reflow.overflowing, JSON.stringify(reflow)).toEqual([]);
};

const assertSceneGeometry = async (page) => {
  const geometry = await page.locator("[data-active=true]").evaluate(scene => {
    const route = scene.querySelector(".route");
    const track = scene.querySelector(".route-track");
    const bounds = route.getBoundingClientRect();
    const center = selector => {
      const rect = scene.querySelector(selector).getBoundingClientRect();
      return (rect.top + rect.height / 2 - bounds.top) / bounds.height * 100;
    };
    return {
      startError: Math.abs(track.getPointAtLength(0).y - center(".domain:not(.target) .selected")),
      endError: Math.abs(track.getPointAtLength(track.getTotalLength()).y - center(".target .selected")),
      rows: [...scene.querySelectorAll(".domain:not(.target) .layer")].map(node => node.textContent),
      targetRows: [...scene.querySelectorAll(".target .layer")].map(node => node.textContent),
    };
  });
  expect(geometry.rows).toEqual(["client", "shared", "server"]);
  expect(geometry.targetRows).toEqual(["client", "shared/public", "server/internal"]);
  expect(geometry.startError).toBeLessThan(1);
  expect(geometry.endError).toBeLessThan(1);
};

test("reflow diagnostics detect content clipped on the left", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("./");
  await page.locator("main").evaluate((main) => {
    const element = document.createElement("div");
    element.className = "left-reflow-fixture";
    Object.assign(element.style, {
      position: "absolute",
      left: "-30px",
      width: "100px",
      height: "20px",
    });
    main.append(element);
  });
  expect((await readReflow(page)).overflowing).toContain(
    "DIV.left-reflow-fixture",
  );
});

test("documentation images resolve to published docs assets", async ({
  page,
}) => {
  await page.goto("./docs/brand/");
  const mark = page.getByRole("img", { name: "Boundra mark" });
  await expect(mark).toHaveAttribute(
    "src",
    "/boundra/docs/assets/boundra-mark.svg",
  );
  expect(
    await mark.evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
});

for (const width of [1440, 768, 390, 320]) {
  test(`landing and documentation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-active=true] .rule")).toHaveText("BR-001");
    await expect(page.locator(".boundary-stage")).toHaveAttribute("data-ready", "true");
    await assertSceneGeometry(page);
    if (width >= 921) {
      const bottom = await page.locator(".hero-band").evaluate(element => element.getBoundingClientRect().bottom);
      expect(bottom).toBeGreaterThanOrEqual(899);
    }
    await page.screenshot({
      path: testInfo.outputPath("landing.png"),
      fullPage: true,
    });
    await assertReflow(page);
    const next = page.getByRole("button", { name: "Next example" });
    await expect(page.getByRole("button", { name: "Pause animation" })).toBeHidden();
    for (const rule of ["PASS", "BR-004", "PASS", "BR-006", "PASS"]) {
      await next.press("Enter");
      await expect(page.locator("[data-active=true] .rule")).toHaveText(rule);
      await assertSceneGeometry(page);
      await assertReflow(page);
    }
    await expect(page.locator("[data-active=true] [data-scene-title]")).toHaveText("Allowed by boundary rules");
    await expect(page.getByRole("status")).toHaveText("Allowed by boundary rules");
    await page.screenshot({ path: testInfo.outputPath("allowed-import.png"), fullPage: true });
    expect(
      await page.evaluate(() =>
        [...document.images].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/docs\/user-guide\/$/);
    await expect(
      page.getByRole("heading", { name: "Boundra user guide" }),
    ).toBeVisible();
    await assertReflow(page);
    await page.screenshot({
      path: testInfo.outputPath("documentation.png"),
      fullPage: true,
    });
    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "한국어", exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/user-guide\.ko\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await assertReflow(page);
    expect(errors).toEqual([]);
  });
}

test("automatic boundary sequence pauses and supports explicit inspection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const rule = page.locator("[data-active=true] .rule");
  await expect(rule).toHaveText("BR-001");
  await expect(page.getByRole("button", { name: "Next example" })).toBeHidden();
  const stage = page.locator(".boundary-stage");
  await expect(stage).toHaveAttribute("data-running", "true");
  const packet = page.locator("[data-active=true] .route-packet");
  await expect(packet).toHaveCSS("animation-iteration-count", "infinite");
  const blocked = await packet.getAttribute("d");
  expect(blocked).not.toContain("100 ");
  await expect(rule).toHaveText("PASS", { timeout: 4000 });
  expect(await packet.getAttribute("d")).toContain("100 ");
  await expect(rule).toHaveText("BR-004", { timeout: 3500 });
  await expect(rule).toHaveText("PASS", { timeout: 4000 });
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(page.getByRole("button", { name: "Resume animation" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.locator("h1").click();
  await page.waitForTimeout(5500);
  await expect(rule).toHaveText("PASS");
  await page.getByRole("button", { name: "Next example" }).click();
  await expect(rule).toHaveText("BR-006");
  await expect(stage).toHaveAttribute("data-running", "false");
  await page.getByRole("button", { name: "Resume animation" }).click();
  await page.locator("#quickstart").scrollIntoViewIfNeeded();
  await page.locator("#quickstart h2").click();
  await page.mouse.move(0,0);
  await page.waitForTimeout(5500);
  await expect(rule).toHaveText("BR-006");
});

for (const [route, lang, name, start, suffix] of [
  ["ko/", "ko", "한국어", "시작하기", "ko"],
  ["ja/", "ja", "日本語", "始める", "ja"],
  ["zh-cn/", "zh-CN", "简体中文", "开始使用", "zh-cn"],
]) {
  for (const width of [320, 1440]) {
    test(`localized ${lang} landing at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('link[rel=alternate][hreflang="en"]')).toHaveCount(1);
      await assertReflow(page);
      await page.screenshot({ path: testInfo.outputPath("localized-landing.png"), fullPage: true });
      const picker = page.locator(".language-select [role=combobox]");
      await picker.click();
      await expect(page.getByRole("option", { name, exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("option", { name: "English", exact: true })).toBeVisible();
      await picker.press("Escape");
      await page.getByRole("link", { name: start, exact: true }).click();
      await expect(page).toHaveURL(new RegExp("user-guide\\." + suffix + "/$"));
      await assertReflow(page);
    });
  }
}

test("localized documentation keeps the locale and examples in the docs index", async ({ page }) => {
  await page.goto("ko/");
  await page.getByRole("link", {name:"문서",exact:true}).first().click();
  await expect(page).toHaveURL(/\/docs\/ko\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang","ko");
  await expect(page.locator(".docs-sidebar a[href='/boundra/docs/boundary-rules/']")).toHaveCount(0);
  await page.locator(".doc-content").getByRole("link",{name:"주문과 청구 예제"}).click();
  await expect(page).toHaveURL(/\/docs\/ko\/example\/$/);
  const picker = page.locator(".language-select [role=combobox]");
  await picker.click();
  await page.getByRole("option",{name:"日本語",exact:true}).click();
  await expect(page).toHaveURL(/\/docs\/ja\/example\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang","ja");
});

test("copy preserves complete code and displays Oddmash UI feedback", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("docs/user-guide/");
  const pre = page.locator(".doc-content pre").first();
  const expected = await pre.locator("code").textContent();
  await page.getByRole("button",{name:"Copy code"}).first().click();
  await expect(page.locator(".om-toast [role=status]")).toHaveText("Code copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  const alignment = await page.locator(".om-toast").evaluate(toast => {
    const icon = toast.querySelector(".om-toast-icon").getBoundingClientRect();
    const title = toast.querySelector("strong").getBoundingClientRect();
    return Math.abs(icon.top + icon.height/2 - title.top - title.height/2);
  });
  expect(alignment).toBeLessThanOrEqual(4);
  await page.getByRole("button",{name:"Dismiss notification"}).click();
  await expect(page.locator(".om-toast-region")).toHaveAttribute("data-state",/closing|closed/);
});

test("copy failure gives honest localized feedback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {value:{writeText: () => Promise.reject(new Error("denied"))},configurable:true});
  });
  await page.goto("docs/user-guide.ko/");
  await page.getByRole("button",{name:"코드 복사"}).first().click();
  await expect(page.locator(".om-toast [role=alert]")).toContainText("코드를 복사하지 못했어요");
});
