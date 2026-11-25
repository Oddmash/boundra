const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const root = document.documentElement;
  const position = () => Math.max(0, window.scrollY);
  const updateHeight = () => root.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
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

  updateHeight();
  show(true);
  if ('ResizeObserver' in window) new ResizeObserver(updateHeight).observe(header);
  else window.addEventListener('resize', updateHeight, { passive: true });
  window.addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  header.addEventListener('focusin', () => {
    show(true);
    distance = 0;
    direction = 0;
  });
  window.addEventListener('pageshow', () => {
    previous = position();
    direction = 0;
    distance = 0;
    show(true);
  });
}
