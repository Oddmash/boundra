# Boundra landing

Astro prerenders the landing and documentation pages without client-side application hydration. The GitHub Pages project path is `/boundra/`.

The boundary demonstration prerenders the released Oddmash UI Button for pause and next. Its product-specific scene controller enables the buttons and updates their labels after script initialization. The controls stay hidden without JavaScript, while the first example remains readable. Keep shared component behavior and tokens separate from the demonstration's Boundra-specific diagram and motion.

From this directory use the pinned pnpm version and run `pnpm install --frozen-lockfile`, then `pnpm run dev` or `pnpm run build`. CI uploads only `dist/`. The site has its own workspace and lockfile to isolate its dependencies from the published runtime and CLI workspace.

Documentation pages are generated from the repository's `docs/` Markdown files at build time. Update those source files rather than maintaining duplicate copies in the site. Relative Markdown links are rewritten to their web routes. The example page includes actual example source.

Korean documentation uses the published `@oddmash/juliya@0.4.1` release for client-side line wrapping. Other languages retain native wrapping. The temporary exact-version minimum-release-age exception can be removed once the release passes the default maturity window.

Verify the built site with `python3 scripts/validate.py`, then install Chromium with `pnpm exec playwright install chromium` and run `pnpm exec playwright test`. CI checks all generated links and four representative viewport widths.
