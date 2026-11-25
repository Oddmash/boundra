import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { cp } from "node:fs/promises";
import remarkDocLinks from "./remark-doc-links.mjs";
import { PUBLIC_SITE, PUBLIC_BASE, writePublicDocs } from "./scripts/public-docs.mjs";

export default defineConfig({
  site: PUBLIC_SITE,
  base: PUBLIC_BASE,
  output: "static",
  markdown: {
    processor: unified({ remarkPlugins: [remarkDocLinks], smartypants: false }),
  },
  integrations: [
    {
      name: "docs-assets",
      hooks: {
        "astro:build:done": async ({ dir }) => {
          await cp(
            new URL("../docs/assets/", import.meta.url),
            new URL("docs/assets/", dir),
            { recursive: true },
          );
          await writePublicDocs({ dir });
        },
      },
    },
  ],
});
