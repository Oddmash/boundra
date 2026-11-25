import { LocalePicker } from '@oddmash/ui/locale-picker';
import { ClipboardButton } from '@oddmash/ui/clipboard-button';
import { ToastProvider, useToast } from '@oddmash/ui/toast-provider';
import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal, flushSync } from 'react-dom';
import { docCopy, localeFromLang } from './doc-ui-copy';

const copy = docCopy[localeFromLang(document.documentElement.lang)];
const picker = document.querySelector<HTMLElement>('[data-language-picker]');
const fallback = document.querySelector<HTMLDetailsElement>('[data-language-fallback]');
if (picker && fallback && !fallback.open && !fallback.contains(document.activeElement)) {
  const links = [...fallback.querySelectorAll<HTMLAnchorElement>('a[data-locale]')];
  const options = links.map(link => ({ value: link.dataset.locale!, label: link.textContent!.trim(), lang: link.lang, href: link.href }));
  const revealPicker = () => {
    if (!picker.querySelector('[role="combobox"]')) return;
    observer.disconnect();
    if (fallback.open || fallback.contains(document.activeElement)) return;
    picker.hidden = false;
    fallback.hidden = true;
  };
  const observer = new MutationObserver(revealPicker);
  observer.observe(picker, { childList: true, subtree: true });
  try {
    const root = createRoot(picker);
    flushSync(() => root.render(createElement(LocalePicker, {
      label: fallback.dataset.label!,
      options,
      value: fallback.dataset.current!,
    })));
    revealPicker();
  } catch {
    observer.disconnect();
    picker.hidden = true;
    fallback.hidden = false;
  }
}

const icon = (): ReactNode => createElement('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
  createElement('rect', { x: 8, y: 8, width: 12, height: 12, rx: 2 }),
  createElement('path', { d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }),
);

const CopyAction = ({text}: {text: string}) => {
  const { showToast } = useToast();
  return createElement(ClipboardButton, {
    text,
    labels: { idle: copy.copy, pending: copy.copy, copied: copy.copied, error: copy.failed },
    announce: false,
    title: copy.copy,
    className: 'om-button--icon om-code-block-copy',
    variant: 'ghost',
    size: 'sm',
    onCopied: () => showToast({ title: copy.copied, tone: 'success', duration: 4000 }),
    onCopyError: () => showToast({ title: copy.failed, description: copy.manual, tone: 'error' }),
  }, icon());
};

const toastHost = document.querySelector<HTMLElement>('#copy-toast');
if (toastHost) {
  const actions = [];
  for (const pre of document.querySelectorAll<HTMLPreElement>('.doc-content pre, .code-panel pre, .file-tree pre')) {
    const code = pre.querySelector('code');
    if (!code || pre.parentElement?.classList.contains('copy-code-shell')) continue;
    const panel = pre.closest<HTMLElement>('.code-panel, .file-tree');
    const shell = document.createElement('div');
    shell.className = panel ? 'copy-code-shell' : 'copy-code-shell om-code-block';
    panel?.classList.add('om-code-block');
    pre.classList.add('om-code-block-content');
    if (!pre.hasAttribute('tabindex')) pre.tabIndex = 0;
    const action = document.createElement('div');
    action.className = 'copy-code-action';
    action.dataset.omTheme = pre.classList.contains('astro-code') ? 'dark' : 'light';
    pre.before(shell);
    shell.append(pre, action);
    actions.push(createPortal(createElement(CopyAction, { text: code.textContent ?? '' }), action));
  }
  createRoot(toastHost).render(createElement(ToastProvider, { dismissLabel: copy.dismiss }, actions));
}
