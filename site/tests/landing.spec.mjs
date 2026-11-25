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
    const source = scene.querySelector(".scene-code").getBoundingClientRect();
    const checker = scene.querySelector(".checker").getBoundingClientRect();
    const blocked = scene.querySelector('[data-outcome="blocked"]').getBoundingClientRect();
    const allowed = scene.querySelector('[data-outcome="allowed"]').getBoundingClientRect();
    const point = (selector, atEnd) => {
      const path = scene.querySelector(selector);
      return path.getPointAtLength(atEnd ? path.getTotalLength() : 0).matrixTransform(path.getScreenCTM());
    };
    const distance = (point, rect, bottom) => Math.hypot(
      point.x - (rect.left + rect.width / 2),
      point.y - (bottom ? rect.bottom : rect.top)
    );
    const selected = scene.querySelector('[data-selected="true"]').dataset.outcome;
    return {
      errors: [
        distance(point(".scan-wire .wire-track", false), source, true),
        distance(point(".scan-wire .wire-track", true), checker, false),
        distance(point('[data-branch="blocked"]', false), checker, true),
        distance(point('[data-branch="allowed"]', false), checker, true),
        distance(point('[data-branch="blocked"]', true), blocked, false),
        distance(point('[data-branch="allowed"]', true), allowed, false),
      ],
      selected,
      signal: scene.querySelector(".decision-signal").getAttribute("d"),
      selectedTrack: scene.querySelector(`[data-branch="${selected}"]`).getAttribute("d"),
      accepted: scene.classList.contains("accepted"),
      count: scene.querySelectorAll('[data-selected="true"]').length,
      phase: scene.closest(".boundary-stage").dataset.phase,
      wires: [...scene.querySelectorAll(".wire-signal")].map(path => {
        const viewBox = path.ownerSVGElement.viewBox.baseVal;
        const rect = path.ownerSVGElement.getBoundingClientRect();
        const matrix = path.getScreenCTM();
        const style = getComputedStyle(path);
        return {
          widthError: Math.abs(viewBox.width - rect.width),
          heightError: Math.abs(viewBox.height - rect.height),
          scaleError: Math.max(Math.abs(matrix.a - 1), Math.abs(matrix.d - 1)),
          lengthError: Math.abs(parseFloat(path.style.getPropertyValue("--wire-length")) - path.getTotalLength()),
          vectorEffect: style.vectorEffect,
          dash: style.strokeDasharray,
          offset: parseFloat(style.strokeDashoffset),
        };
      }),
    };
  });
  expect(geometry.errors.every(error => error <= 1.5), JSON.stringify(geometry)).toBe(true);
  expect(geometry.count).toBe(1);
  expect(geometry.selected).toBe(geometry.accepted ? "allowed" : "blocked");
  expect(geometry.signal).toBe(geometry.selectedTrack);
  for (const wire of geometry.wires) {
    expect(wire.widthError).toBeLessThan(0.1);
    expect(wire.heightError).toBeLessThan(0.1);
    expect(wire.scaleError).toBeLessThan(0.01);
    expect(wire.lengthError).toBeLessThan(0.1);
    expect(wire.vectorEffect).toBe("none");
    if (geometry.phase === "result") {
      expect(wire.dash).toBe("none");
      expect(wire.offset).toBe(0);
    }
  }
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
    await expect(page.locator(".boundary-stage")).toHaveAttribute("data-phase", "result");
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

test("the boundary scan routes the result in one synchronized sequence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    window.boundraTrace = [];
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const element = record.target;
        if (!(element instanceof HTMLElement) || !element.hasAttribute("data-boundary-stage")) continue;
        const scene = element.querySelector("[data-active=true]");
        if (!scene) continue;
        const scanSignal = scene.querySelector(".scan-signal");
        const decisionSignal = scene.querySelector(".decision-signal");
        const decisionStyle = getComputedStyle(decisionSignal);
        window.boundraTrace.push({
          phase: element.dataset.phase,
          scene: scene.dataset.scene,
          input: Number(element.style.getPropertyValue("--input-offset")),
          output: Number(element.style.getPropertyValue("--decision-offset")),
          check: Number(element.style.getPropertyValue("--check-progress")),
          scanDash: getComputedStyle(scanSignal).strokeDasharray,
          outputDash: decisionStyle.strokeDasharray,
          outputVisible: decisionStyle.visibility === "visible",
          outputLength: decisionSignal.getTotalLength(),
          outputOffset: parseFloat(decisionStyle.strokeDashoffset),
        });
      }
    });
    observer.observe(document, { subtree: true, attributeFilter: ["data-phase"] });
  });
  await page.goto("./");
  const stage = page.locator(".boundary-stage");
  await expect(stage).toHaveAttribute("data-running", "true");
  const rule = page.locator("[data-active=true] .rule");
  await expect(rule).toHaveText("BR-001");
  await expect(page.getByRole("button", { name: "Next example" })).toBeHidden();
  await assertSceneGeometry(page);

  await expect(stage).toHaveAttribute("data-phase", "result", { timeout: 4000 });
  const states = await page.evaluate(() => window.boundraTrace.filter(state => state.scene === "0"));
  const checking = states.find(state => state.phase === "checking");
  const decision = states.find(state => state.phase === "decision");
  expect(checking).toBeDefined();
  expect(decision).toBeDefined();
  expect(checking.input).toBe(0);
  expect(checking.output).toBe(100);
  expect(checking.scanDash).toBe("none");
  expect(checking.outputVisible).toBe(false);
  expect(decision.input).toBe(0);
  expect(decision.check).toBe(1);
  expect(decision.outputVisible).toBe(true);
  expect(decision.outputDash).not.toBe("none");
  expect(Math.abs(parseFloat(decision.outputDash) - decision.outputLength)).toBeLessThan(0.1);
  expect(Math.abs(decision.outputOffset - decision.outputLength * decision.output / 100)).toBeLessThan(0.1);
  expect(states.at(-1)).toMatchObject({ phase: "result", scene: "0", input: 0, output: 0, check: 1, scanDash: "none", outputDash: "none", outputVisible: true, outputOffset: 0 });
  await expect(page.locator('[data-active=true] [data-selected="true"]')).toHaveAttribute("data-outcome", "blocked");
  await expect(page.locator("[data-active=true] [data-scene-title]")).toBeVisible();

  await expect(rule).toHaveText("PASS", { timeout: 5000 });
  await expect(page.locator('[data-active=true] .syntax-string')).toHaveClass(/revised/);
  await expect(stage).toHaveAttribute("data-phase", "result", { timeout: 3500 });
  await expect(page.locator('[data-active=true] [data-selected="true"]')).toHaveAttribute("data-outcome", "allowed");
  await assertSceneGeometry(page);

  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(page.getByRole("button", { name: "Resume animation" })).toBeVisible();
  await expect(stage).toHaveAttribute("data-running", "false");
  const frozen = await stage.getAttribute("style");
  await page.waitForTimeout(3600);
  await expect(rule).toHaveText("PASS");
  await expect(stage).toHaveAttribute("style", frozen);
  await page.getByRole("button", { name: "Next example" }).click();
  await expect(rule).toHaveText("BR-004");
  await expect(stage).toHaveAttribute("data-phase", "result");
  await expect(stage).toHaveAttribute("data-running", "false");
  await assertSceneGeometry(page);
  await page.getByRole("button", { name: "Resume animation" }).click();
  await page.locator("#quickstart").scrollIntoViewIfNeeded();
  await page.locator("#quickstart h2").click();
  await page.mouse.move(0, 0);
  await expect(stage).toHaveAttribute("data-running", "false");
  await page.waitForTimeout(3600);
  await expect(rule).toHaveText("BR-004");
});

test("wire geometry follows viewport changes without breaking the result trace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator(".boundary-stage")).toHaveAttribute("data-geometry-ready", "true");
  await assertSceneGeometry(page);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator("[data-active=true] .decision-wire svg").evaluate(svg => {
      const bounds = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      return Math.max(Math.abs(bounds.width - viewBox.width), Math.abs(bounds.height - viewBox.height));
    })).toBeLessThan(0.1);
    await assertSceneGeometry(page);
    await assertReflow(page);
  }
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

test("documentation cards sweep their background from left to right without shifting content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("ko/");
  const card = page.locator(".doc-list > a").first();
  const readStyle = () => card.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const heading = element.querySelector("h3").getBoundingClientRect();
    return {
      fill: style.backgroundSize,
      image: style.backgroundImage,
      position: style.backgroundPositionX,
      repeat: style.backgroundRepeat,
      transition: style.transitionProperty,
      duration: style.transitionDuration,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      titleLeft: heading.left,
    };
  });
  const initial = await readStyle();
  expect(initial).toMatchObject({ fill: "0% 100%", position: "0%", repeat: "no-repeat" });
  expect(initial.image).toContain("linear-gradient");
  expect(initial.transition).toContain("background-size");
  expect(initial.duration).not.toBe("0s");

  await card.hover();
  await expect.poll(async () => (await readStyle()).fill).toBe("100% 100%");
  expect(await readStyle()).toMatchObject({
    left: initial.left,
    width: initial.width,
    height: initial.height,
    titleLeft: initial.titleLeft,
  });
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await readStyle()).fill).toBe("0% 100%");

  await page.keyboard.press("Tab");
  await card.focus();
  await expect(card).toBeFocused();
  await expect.poll(() => card.evaluate(element => element.matches(":focus-visible"))).toBe(true);
  await expect.poll(async () => (await readStyle()).fill).toBe("100% 100%");
  expect(await card.evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid");
  await card.press("Enter");
  await expect(page).toHaveURL(/\/docs\/user-guide\.ko\/$/);
});

test("documentation card fill respects the reduced motion setting", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const card = page.locator(".doc-list > a").first();
  await card.hover();
  expect(await card.evaluate(element => {
    const style = getComputedStyle(element);
    return { fill: style.backgroundSize, duration: style.transitionDuration };
  })).toEqual({ fill: "100% 100%", duration: "0s" });
});
