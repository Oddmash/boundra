import type { MarkdownInstance } from 'astro';
import type { LandingLocale } from './landing-copy';
import { docCopy } from './doc-ui-copy';
import { groups } from './docs-inventory.mjs';

const docs = import.meta.glob<MarkdownInstance<Record<string, unknown>>>('../../docs/**/*.md', { eager: true });
const documents = new Map(Object.entries(docs).map(([path, document]) => [path.replace(/^.*?\/docs\//, '').replace(/\.md$/, ''), document]));

export { groups } from './docs-inventory.mjs';


export const docsHome = (base: string, locale: LandingLocale) => base + 'docs/' + (locale === 'en' ? '' : locale + '/');
export const docPath = (base: string, slug: string, locale: LandingLocale): string | undefined => {
  const root = slug.replace(/\.(?:ko|ja|zh-cn)$/, '');
  if (!root) return docsHome(base, locale);
  if (root === 'example') return docsHome(base, locale) + 'example/';
  const translated = root + (locale === 'en' ? '' : '.' + locale);
  return documents.has(translated) ? base + 'docs/' + translated + '/' : undefined;
};

export function localGroups(base: string, locale: LandingLocale) {
  return groups.map((group, index) => ({
    label: docCopy[locale].groups[index],
    items: group.items.flatMap(([slug, label]) => {
      const href = docPath(base, slug, locale);
      if (!href) return [];
      const localized = slug === 'example' ? docCopy[locale].example :
        documents.get(slug + (locale === 'en' ? '' : '.' + locale))?.getHeadings().find(heading => heading.depth === 1)?.text ?? label;
      return [{ slug, label: locale === 'en' ? label : localized, href }];
    }),
  })).filter(group => group.items.length);
}
