import type { MarkdownInstance } from 'astro';
import type { LandingLocale } from './landing-copy';
import { docCopy } from './doc-ui-copy';

const docs = import.meta.glob<MarkdownInstance<Record<string, unknown>>>('../../docs/**/*.md', { eager: true });
const documents = new Map(Object.entries(docs).map(([path, document]) => [path.replace(/^.*?\/docs\//, '').replace(/\.md$/, ''), document]));

export const groups = [
  {
    label: "Start here",
    items: [
      ["user-guide", "User guide"],
      ["quickstart", "Quickstart"],
      ["cli-install", "Installation"],
      ["example", "Order and billing example"],
    ],
  },
  {
    label: "Architecture",
    items: [
      ["architecture", "Architecture"],
      ["boundary-rules", "Boundary rules"],
      ["domain-manifest-spec", "Domain manifests"],
      ["product-positioning", "Adoption and limitations"],
    ],
  },
  {
    label: "Runtime and frameworks",
    items: [
      ["contract-schema-spec", "Contracts"],
      ["http-transport", "HTTP transport"],
      ["framework-surface", "Framework surface"],
      ["vite-integration", "Vite integration"],
      ["error-view", "Development error view"],
    ],
  },
  {
    label: "Reference",
    items: [
      ["cli-spec-v1", "CLI commands"],
      ["config-spec", "Configuration"],
      ["config-authoring", "Configuration authoring"],
      ["diagnostic-spec", "Diagnostics"],
      ["ci-integration", "CI integration"],
      ["performance", "Performance"],
      ["framework-conformance", "Framework compatibility"],
    ],
  },
];

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
