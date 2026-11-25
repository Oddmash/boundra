import { Select } from '@oddmash/ui/select';
import { Button } from '@oddmash/ui/button';
import { Toast, ToastViewport } from '@oddmash/ui/toast';
import { createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { docCopy, localeFromLang } from './doc-ui-copy';

const copy = docCopy[localeFromLang(document.documentElement.lang)];
const picker = document.querySelector<HTMLElement>('[data-language-picker]');
const fallback = document.querySelector<HTMLElement>('[data-language-fallback]');
if (picker && fallback) {
  const links = [...fallback.querySelectorAll<HTMLAnchorElement>('a[data-locale]')];
  const options = links.map(link => ({ value: link.dataset.locale!, label: link.textContent!.trim(), lang: link.lang }));
  try {
    const root = createRoot(picker);
    flushSync(() => root.render(createElement(Select, {
      'aria-label': fallback.dataset.label,
      options,
      value: fallback.dataset.current,
      onValueChange: value => {
        const link = links.find(item => item.dataset.locale === value);
        if (link) location.assign(link.href);
      },
    })));
    if (picker.querySelector('[role="combobox"]')) {
      picker.hidden = false;
      fallback.hidden = true;
    }
  } catch {
    picker.hidden = true;
    fallback.hidden = false;
  }
}

let toastRoot: Root | undefined;
let timeout: number | undefined;
function notify(failed = false) {
  const host = document.querySelector<HTMLElement>('#copy-toast');
  if (!host) return;
  toastRoot ??= createRoot(host);
  if (timeout !== undefined) window.clearTimeout(timeout);
  const render = (open: boolean) => toastRoot?.render(createElement(ToastViewport, null, createElement(Toast, {
    open,
    title: failed ? copy.failed : copy.copied,
    tone: failed ? 'error' : 'success',
    dismissLabel: copy.dismiss,
    onDismiss: () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      render(false);
    },
  }, failed ? copy.manual : undefined)));
  render(true);
  if (!failed) timeout = window.setTimeout(() => render(false), 4000);
}

const icon = (): ReactNode => createElement('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
  createElement('rect', { x: 8, y: 8, width: 12, height: 12, rx: 2 }),
  createElement('path', { d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }),
);

for (const pre of document.querySelectorAll<HTMLPreElement>('.doc-content pre, .code-panel pre, .file-tree pre')) {
  const code = pre.querySelector('code');
  if (!code || pre.parentElement?.classList.contains('copy-code-shell')) continue;
  const shell = document.createElement('div');
  shell.className = 'copy-code-shell';
  const action = document.createElement('div');
  action.className = 'copy-code-action';
  action.dataset.omTheme = pre.classList.contains('astro-code') ? 'dark' : 'light';
  pre.before(shell);
  shell.append(pre, action);
  const root = createRoot(action);
  root.render(createElement(Button, {
    variant: 'ghost',
    size: 'sm',
    'aria-label': copy.copy,
    title: copy.copy,
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(code.textContent ?? '');
        notify();
      } catch {
        notify(true);
      }
    },
  }, icon()));
}
