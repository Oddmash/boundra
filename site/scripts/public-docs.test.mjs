import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { publicLocales, publicSlugs } from "../src/docs-inventory.mjs";
import { rewriteMarkdownLinks, verifyPublicDocs, writePublicDocs } from "./public-docs.mjs";

const baseUrl = new URL("https://example.org/project/");
const context = { slug: "user-guide", locale: "ko", baseUrl };

test("public Markdown links preserve the language, anchors, example links and code", () => {
  const input = [
    "[English](user-guide.md) · [日本語](user-guide.ja.md)",
    "[설치](cli-install.md)",
    "[계약](contract-schema-spec.md#3-contract-shape)",
    "[예제](../examples/order-billing)",
    "[이 페이지](#heading)",
    "[`error-view.md`](./error-view.md)",
    "[external](https://example.org/elsewhere)",
    "`[not a link](non-public.md)`",
    "```md",
    "[not a link](non-public.md)",
    "```",
    "~~~md",
    "[not a link](non-public.md)",
    "~~~",
  ].join("\n");
  const expected = [
    "[English](https://example.org/project/llms/en/user-guide.md) · [日本語](https://example.org/project/llms/ja/user-guide.md)",
    "[설치](https://example.org/project/llms/ko/cli-install.md)",
    "[계약](https://example.org/project/docs/contract-schema-spec/#3-contract-shape)",
    "[예제](https://example.org/project/docs/ko/example/)",
    "[이 페이지](https://example.org/project/docs/user-guide.ko/#heading)",
    "[`error-view.md`](https://example.org/project/llms/ko/error-view.md)",
    "[external](https://example.org/elsewhere)",
    "`[not a link](non-public.md)`",
    "```md",
    "[not a link](non-public.md)",
    "```",
    "~~~md",
    "[not a link](non-public.md)",
    "~~~",
  ].join("\n");
  assert.equal(rewriteMarkdownLinks(input, context), expected);
  assert.throws(() => rewriteMarkdownLinks("[internal](releases/v0-1-0.md)", context), /Unexpected public documentation link/);
});

test("public docs generation uses only the shared allowlist and checks the built artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "boundra-public-docs-"));
  try {
    const docsRoot = join(root, "docs");
    const dir = join(root, "dist");
    const rootPackage = join(root, "package.json");
    await mkdir(docsRoot);
    await mkdir(dir);
    await writeFile(rootPackage, JSON.stringify({ version: "1.2.3" }));
    await writeFile(join(docsRoot, "internal.md"), "# Internal\n");
    await mkdir(join(docsRoot, "releases"));
    await writeFile(join(docsRoot, "releases", "v1-2-3.md"), "# Release archive\n");
    const html = async path => {
      await mkdir(join(dir, path), { recursive: true });
      await writeFile(join(dir, path, "index.html"), "<h1>Public</h1>");
    };
    for (const locale of publicLocales) {
      const suffix = locale === "en" ? "" : "." + locale;
      await Promise.all(publicSlugs.map(async slug => {
        await writeFile(join(docsRoot, slug + suffix + ".md"), "# " + slug + "\n");
        await html("docs/" + slug + suffix);
      }));
      const prefix = locale === "en" ? "docs/" : "docs/" + locale + "/";
      await html(prefix);
      await html(prefix + "example");
    }

    const options = { dir, docsRoot, rootPackage, site: "https://example.org", base: "/project" };
    const count = await writePublicDocs(options);
    assert.equal(count, publicLocales.length * publicSlugs.length);
    assert.equal(await verifyPublicDocs(options), count);
    const index = await readFile(join(dir, "llms.txt"), "utf8");
    assert.match(index, /Version: v1\.2\.3/);
    assert.match(index, /https:\/\/example\.org\/project\/llms\/zh-cn\/user-guide\.md/);
    assert.match(index, /https:\/\/example\.org\/project\/docs\/ja\/example\//);
    assert.doesNotMatch(index, /internal|releases\/|llms\/en\/example\.md/);
    await writeFile(join(dir, "llms", "en", "internal.md"), "# Internal\n");
    await assert.rejects(verifyPublicDocs(options), /curated inventory/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
