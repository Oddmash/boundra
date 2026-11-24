from html.parser import HTMLParser
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

print(f'Validated {len(pages)} pages and {sum(len(page.links) for page in pages.values())} link references')
