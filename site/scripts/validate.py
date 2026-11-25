from html.parser import HTMLParser
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'duplicate ID: {attrs["id"]}'
            self.ids.add(attrs['id'])
        self.links.extend(attrs[key] for key in ('href', 'src') if key in attrs)


root = Path(__file__).resolve().parents[1] / 'dist'
pages = {}
for file in sorted(root.rglob('*.html')):
    page = Page()
    page.feed(file.read_text(encoding='utf-8'))
    pages[file] = page

for page_path, page in pages.items():
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        path = unquote(parsed.path)
        if path.startswith('/'):
            assert path.startswith('/boundra/'), (page_path, link)
            target = root / path.removeprefix('/boundra/')
        elif path:
            target = page_path.parent / path
        else:
            target = page_path
        target = target.resolve()
        assert target.is_relative_to(root), (page_path, link)
        if target.is_dir():
            target = target / 'index.html'
        assert target.is_file(), (page_path, link)
        if parsed.fragment:
            assert target in pages and unquote(parsed.fragment) in pages[target].ids, (page_path, link)

for locale in ('', '.ko', '.ja', '.zh-cn'):
    assert root / 'docs' / f'user-guide{locale}' / 'index.html' in pages

docs_root = Path(__file__).resolve().parents[2] / 'docs'
locales = ('ko', 'ja', 'zh-cn')
reference_sets = []


def code_blocks(text):
    return [
        block.rstrip()
        for block in re.findall(r'^\x60\x60\x60[^\n]*\n.*?^\x60\x60\x60[^\n]*$', text, re.M | re.S)
    ]


for locale in locales:
    references = {
        path.name.removesuffix(f'.{locale}.md'): path
        for path in docs_root.glob(f'*.{locale}.md')
    }
    reference_sets.append(set(references))
    for slug, translated in references.items():
        original = (docs_root / f'{slug}.md').read_text(encoding='utf-8')
        content = translated.read_text(encoding='utf-8')
        assert code_blocks(original) == code_blocks(content), (slug, locale, 'code example mismatch')
        assert root / 'docs' / f'{slug}.{locale}' / 'index.html' in pages
assert reference_sets[0] == reference_sets[1] == reference_sets[2], 'reference localization coverage differs'

print(f'Validated {len(pages)} pages and {sum(len(page.links) for page in pages.values())} link references')
