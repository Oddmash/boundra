# Boundra landing

Astro prerenders the landing and documentation pages without client-side application hydration. The GitHub Pages project path is `/boundra/`.

From this directory run `npm ci`, then `npm run dev` or `npm run build`. CI uploads only `dist/`. The site has its own lockfile to isolate its dependencies from the published runtime and CLI workspace.

Documentation pages are generated from the repository's `docs/` Markdown files at build time. Update those source files rather than maintaining duplicate copies in the site. Relative Markdown links are rewritten to their web routes. The example page includes actual example source.

Verify the built site with `python3 scripts/validate.py`, then install Chromium with `npx playwright install chromium` and run `npx playwright test`. CI checks all generated links and four representative viewport widths.
