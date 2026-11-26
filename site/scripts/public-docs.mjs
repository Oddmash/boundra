import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { groups, publicLocales, publicSlugs } from "../src/docs-inventory.mjs";

export const PUBLIC_SITE = "https://oddmash.github.io";
export const PUBLIC_BASE = "/boundra";

const docsRootDefault = new URL("../../docs/", import.meta.url);
const rootPackageDefault = new URL("../../package.json", import.meta.url);
const languageLabels = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  "zh-cn": "简体中文",
};
const exampleLabels = {
  en: "Order and billing example",
  ko: "주문과 청구 예제",
  ja: "注文と請求の例",
  "zh-cn": "订单与账单示例",
};

const localeSuffix = (locale) => locale === "en" ? "" : "." + locale;
const sourceName = (slug, locale) => slug + localeSuffix(locale) + ".md";
const artifactPath = (slug, locale) => "llms/" + locale + "/" + slug + ".md";
const htmlPath = (slug, locale) => "docs/" + slug + localeSuffix(locale) + "/";
const examplePath = (locale) => "docs/" + (locale === "en" ? "" : locale + "/") + "example/";
const docsPath = (locale) => "docs/" + (locale === "en" ? "" : locale + "/");
const canonicalBase = (site, base) => new URL(base.replace(/\/+$/, "") + "/", site);

function publicLink(target, context, languageSwitch) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) return target;
  const { slug, locale, baseUrl } = context;
  if (target.startsWith("#")) return new URL(htmlPath(slug, locale) + target, baseUrl).href;
  if (target.startsWith("/")) {
    const url = new URL(target, baseUrl);
    assert(url.origin === baseUrl.origin && url.pathname.startsWith(baseUrl.pathname), "Unexpected root-relative documentation target: " + target);
    return url.href;
  }
  const hashIndex = target.indexOf("#");
  const path = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : target.slice(hashIndex);
  const cleanPath = posix.normalize(path);
  if (cleanPath === "../examples/order-billing") return new URL(examplePath(locale) + hash, baseUrl).href;
  if (cleanPath.startsWith("assets/")) return new URL("docs/" + cleanPath + hash, baseUrl).href;
  const match = /^([a-z0-9-]+)(?:\.(ko|ja|zh-cn))?\.md$/.exec(cleanPath);
  assert(match && publicSlugs.includes(match[1]), "Unexpected public documentation link in " + sourceName(slug, locale) + ": " + target);
  const [, targetSlug, explicitLocale] = match;
  const targetLocale = explicitLocale || (languageSwitch || hash ? "en" : locale);
  if (hash) return new URL(htmlPath(targetSlug, targetLocale) + hash, baseUrl).href;
  return new URL(artifactPath(targetSlug, targetLocale), baseUrl).href;
}

export function rewriteMarkdownLinks(markdown, context) {
  let fence;
  return markdown.split("\n").map((line) => {
    if (fence) {
      const ending = /^ {0,3}([`~]{3,})[ \t\r]*$/.exec(line);
      if (ending && ending[1][0] === fence[0] && ending[1].length >= fence.length && [...ending[1]].every(char => char === fence[0])) {
        fence = undefined;
      }
      return line;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opening) {
      fence = opening[1];
      return line;
    }
    if (/^(?: {4}|\t)/.test(line)) return line;
    const languageSwitch = context.slug === "user-guide" && line.split(" · ").length > 1
      && line.split(" · ").every(part => /^\[[^\]]+\]\(user-guide(?:\.(?:ko|ja|zh-cn))?\.md\)$/.test(part.trim()));
    return line.replace(/(?<!\\)(!?\[(?:\\.|[^\]\\])+\]\()(<[^>\n]+>|[^\s)\n]+)(?=\s*(?:["'][^)\n]*["'])?\))|(`+)(.*?)\3/g,
      (token, prefix, rawTarget) => {
        if (!prefix) return token;
        const wrapped = rawTarget.startsWith("<") && rawTarget.endsWith(">");
        const target = wrapped ? rawTarget.slice(1, -1) : rawTarget;
        const url = publicLink(target, context, languageSwitch);
        return prefix + (wrapped ? "<" + url + ">" : url);
      });
  }).join("\n");
}

export function sitemapRoutes() {
  return ["", ...publicLocales.filter(locale => locale !== "en").map(locale => locale + "/"), "docs/frameworks/",
    ...publicLocales.flatMap(locale => [docsPath(locale), examplePath(locale), ...publicSlugs.map(slug => htmlPath(slug, locale))])];
}

export function publicSitemap({ site = PUBLIC_SITE, base = PUBLIC_BASE } = {}) {
  const baseUrl = canonicalBase(site, base);
  const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + sitemapRoutes().map(route => "  <url><loc>" + escape(new URL(route, baseUrl).href) + "</loc></url>").join("\n")
    + "\n</urlset>\n";
}

async function expectedOutputs({ docsRoot = docsRootDefault, rootPackage = rootPackageDefault, site = PUBLIC_SITE, base = PUBLIC_BASE } = {}) {
  const docsDir = docsRoot instanceof URL ? fileURLToPath(docsRoot) : docsRoot;
  const metadata = JSON.parse(await readFile(rootPackage, "utf8"));
  assert(typeof metadata.version === "string" && metadata.version.length > 0, "Root package version is required");
  const baseUrl = canonicalBase(site, base);
  const outputs = new Map();
  const index = [
    "# Boundra",
    "",
    "> Boundra is a Rust-backed TypeScript architecture guardrail that checks declared domain dependencies and import boundaries, and provides a framework-neutral schema-backed contract runtime.",
    "",
    "Version: v" + metadata.version,
    "",
    "Boundra runs in development and CI. It is not an authorization or runtime isolation boundary. Frameworks retain ownership of routing, authentication, persistence, and deployment.",
    "",
    "The following Markdown references are generated from the same public documentation used by the website. Example links point to the rendered HTML example.",
    "",
    "- [Project website](" + baseUrl.href + ")",
  ];
  for (const locale of publicLocales) {
    index.push("", "## " + languageLabels[locale], "", "- [Documentation index (HTML)](" + new URL(docsPath(locale), baseUrl).href + ")");
    for (const { items } of groups) {
      for (const [slug] of items) {
        if (slug === "example") {
          index.push("- [" + exampleLabels[locale] + " (HTML)](" + new URL(examplePath(locale), baseUrl).href + ")");
          continue;
        }
        const source = await readFile(join(docsDir, sourceName(slug, locale)), "utf8");
        const title = /^# (.+)$/m.exec(source)?.[1]?.trim();
        assert(title, "Missing H1 in " + sourceName(slug, locale));
        const path = artifactPath(slug, locale);
        outputs.set(path, rewriteMarkdownLinks(source, { slug, locale, baseUrl }));
        index.push("- [" + title + "](" + new URL(path, baseUrl).href + ")");
      }
    }
  }
  outputs.set("llms.txt", index.join("\n") + "\n");
  return outputs;
}

export async function writePublicDocs({ dir, ...options }) {
  const outputDir = dir instanceof URL ? fileURLToPath(dir) : dir;
  const outputs = await expectedOutputs(options);
  await Promise.all(publicLocales.map(locale => mkdir(join(outputDir, "llms", locale), { recursive: true })));
  await Promise.all([...outputs].map(([path, content]) => writeFile(join(outputDir, path), content, "utf8")));
  await writeFile(join(outputDir, "sitemap.xml"), publicSitemap(options), "utf8");
  return outputs.size - 1;
}

export async function verifyPublicDocs({ dir, ...options }) {
  const outputDir = dir instanceof URL ? fileURLToPath(dir) : dir;
  const outputs = await expectedOutputs(options);
  const actual = new Set(["llms.txt"]);
  for (const locale of await readdir(join(outputDir, "llms"), { withFileTypes: true })) {
    assert(locale.isDirectory() && publicLocales.includes(locale.name), "Unexpected public documentation locale: " + locale.name);
    for (const file of await readdir(join(outputDir, "llms", locale.name), { withFileTypes: true })) {
      assert(file.isFile(), "Unexpected nested public documentation output: " + file.name);
      actual.add("llms/" + locale.name + "/" + file.name);
    }
  }
  assert.deepEqual([...actual].sort(), [...outputs.keys()].sort(), "Public documentation output must match the curated inventory");
  for (const [path, content] of outputs) {
    assert.equal(await readFile(join(outputDir, path), "utf8"), content, "Public documentation differs from source: " + path);
  }
  for (const locale of publicLocales) {
    for (const path of [docsPath(locale), examplePath(locale), ...publicSlugs.map(slug => htmlPath(slug, locale))]) {
      assert((await stat(join(outputDir, path, "index.html"))).isFile(), "Missing public HTML documentation: " + path);
    }
  }
  assert.equal(await readFile(join(outputDir, "sitemap.xml"), "utf8"), publicSitemap(options));
  for (const route of sitemapRoutes()) {
    assert((await stat(join(outputDir, route, "index.html"))).isFile(), "Missing sitemap page: " + route);
  }
  return outputs.size - 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url && process.argv[2] === "--verify") {
  const count = await verifyPublicDocs({ dir: resolve(process.argv[3]) });
  console.log("Validated public Markdown for " + count + " localized documents and llms.txt");
}
