import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { cp } from "node:fs/promises";
import remarkDocLinks from "./remark-doc-links.mjs";

export default defineConfig({
  site: "https://oddmash.github.io",
  base: "/boundra",
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
        },
      },
    },
  ],
});
