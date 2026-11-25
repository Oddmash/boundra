import { observeScrollHeader } from '@oddmash/ui/scroll-header';

const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const root = document.documentElement;
  const hero = document.querySelector<HTMLElement>('.landing-page .hero-band');
  let themeRevision = 0;
  const updateTheme = () => {
    const theme = hero && hero.getBoundingClientRect().bottom > 0 ? 'dark' : 'light';
    if (header.dataset.headerTheme === theme) return;
    const revision = ++themeRevision;
    header.dataset.themeSwitching = 'true';
    header.dataset.headerTheme = theme;
    header.dataset.omTheme = theme;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (revision === themeRevision) delete header.dataset.themeSwitching;
    }));
  };
  let stopScroll: (() => void) | undefined;
  let observedHeight = -1;
  let queued = false;

  const syncVisible = () => {
    const hidden = header.dataset.omScrollHidden === 'true';
    header.dataset.scrollHidden = String(hidden);
    root.dataset.headerVisible = String(!hidden);
  };
  const state = new MutationObserver(syncVisible);
  state.observe(header, { attributes: true, attributeFilter: ['data-om-scroll-hidden'] });
  const updateLayout = () => {
    const height = header.offsetHeight;
    root.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
    if (height !== observedHeight) {
      stopScroll?.();
      observedHeight = height;
      stopScroll = observeScrollHeader(header, { hideThreshold: 16, revealThreshold: 8, topOffset: height });
      syncVisible();
    }
    updateTheme();
  };

  updateLayout();
  const resize = 'ResizeObserver' in window ? new ResizeObserver(updateLayout) : undefined;
  resize?.observe(header);
  if (hero) resize?.observe(hero);
  window.addEventListener('resize', updateLayout, { passive: true });
  window.addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        updateTheme();
      });
    }
  }, { passive: true });
  window.addEventListener('pageshow', updateLayout);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stopScroll?.();
    resize?.disconnect();
    state.disconnect();
  });
}
