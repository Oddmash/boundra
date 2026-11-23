import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkDocLinks from './remark-doc-links.mjs';

export default defineConfig({
  site: 'https://oddmash.github.io',
  base: '/boundra',
  output: 'static',
  markdown: { processor: unified({ remarkPlugins: [remarkDocLinks], smartypants: false }) },
});
