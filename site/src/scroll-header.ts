const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const root = document.documentElement;
  const hero = document.querySelector<HTMLElement>('.landing-page .hero-band');
  let themeRevision = 0;
  const updateTheme = () => {
    const midpoint = Math.min(header.offsetHeight, window.innerHeight) / 2;
    const theme = hero && hero.getBoundingClientRect().bottom > midpoint ? 'dark' : 'light';
    if (header.dataset.headerTheme === theme) return;
    const revision = ++themeRevision;
    header.dataset.themeSwitching = 'true';
    header.dataset.headerTheme = theme;
    header.dataset.omTheme = theme;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (revision === themeRevision) delete header.dataset.themeSwitching;
    }));
  };
  const position = () => Math.max(0, window.scrollY);
  const updateLayout = () => {
    root.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
    updateTheme();
  };
  const show = (visible: boolean) => {
    header.dataset.scrollHidden = String(!visible);
    root.dataset.headerVisible = String(visible);
  };

  let previous = position();
  let distance = 0;
  let direction = 0;
  let queued = false;
  const hasActiveMenu = () => header.contains(document.activeElement) ||
    header.querySelector('details[open], [aria-expanded="true"]') !== null;

  const update = () => {
    queued = false;
    const current = position();
    const delta = current - previous;
    previous = current;
    updateTheme();
    if (current <= header.offsetHeight || hasActiveMenu()) {
      show(true);
      direction = 0;
      distance = 0;
      return;
    }
    if (!delta) return;
    const nextDirection = Math.sign(delta);
    if (nextDirection !== direction) {
      direction = nextDirection;
      distance = 0;
    }
    distance += Math.abs(delta);
    if (direction < 0 && distance >= 8) show(true);
    if (direction > 0 && distance >= 16) show(false);
  };

  updateLayout();
  show(true);
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(updateLayout);
    resize.observe(header);
    if (hero) resize.observe(hero);
  }
  window.addEventListener('resize', updateLayout, { passive: true });
  window.addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  header.addEventListener('focusin', () => {
    updateTheme();
    show(true);
    distance = 0;
    direction = 0;
  });
  window.addEventListener('pageshow', () => {
    updateLayout();
    previous = position();
    direction = 0;
    distance = 0;
    show(true);
  });
}
