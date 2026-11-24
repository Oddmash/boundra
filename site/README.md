# Boundra landing

Astro prerenders the landing and documentation pages without client-side application hydration. The GitHub Pages project path is `/boundra/`.

From this directory use the pinned pnpm version and run `pnpm install --frozen-lockfile`, then `pnpm run dev` or `pnpm run build`. CI uploads only `dist/`. The site has its own workspace and lockfile to isolate its dependencies from the published runtime and CLI workspace.

The lockfile migration preserves the exact previously locked `@oddmash/kowrap@0.3.3` release and its integrity. The temporary exact-version minimum-release-age exception can be removed once it passes the default maturity window.

Documentation pages are generated from the repository's `docs/` Markdown files at build time. Update those source files rather than maintaining duplicate copies in the site. Relative Markdown links are rewritten to their web routes. The example page includes actual example source.

Verify the built site with `python3 scripts/validate.py`, then install Chromium with `pnpm exec playwright install chromium` and run `pnpm exec playwright test`. CI checks all generated links and four representative viewport widths.
