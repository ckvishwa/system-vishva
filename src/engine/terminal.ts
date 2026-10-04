/**
 * Command terminal overlay (ARD §7 idea 10). Lazy-loaded on first open by islands/Terminal.astro, so it
 * adds nothing before first paint. Output appears instantly: no typing animation, no boot sequence, no
 * window chrome. Everything it prints comes from /terminal.json (built from the content collections and
 * build.json) or from the live page (route, tier). The commands themselves live in terminal-commands.ts.
 *
 * Accessibility: role="dialog" with a focus trap, the page behind is inert, output is an aria-live="polite"
 * log, Esc closes, and focus returns to whatever opened it.
 */
import { run, complete, type TerminalData, type Line, type Tone } from './terminal-commands';
import { prompt } from './prompt';

export interface OpenOptions {
  /** Client-side router navigation (Astro's navigate), so `open <slug>` is a view transition, not a reload. */
  navigate: (url: string) => void;
  /** The element that opened the terminal; focus returns here on close. */
  opener?: HTMLElement | null;
}

let data: TerminalData | null = null;
let loading: Promise<void> | null = null;
const history: string[] = [];
let close: ((restoreFocus?: boolean) => void) | null = null;

const load = () => (loading ??= fetch('/terminal.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((d) => { data = d; }).catch(() => { loading = null; }));

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export async function openTerminal({ navigate, opener }: OpenOptions): Promise<void> {
  if (close) return;
  const returnTo = opener ?? (document.activeElement as HTMLElement | null);

  const dialog = el('div', 'term');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Terminal');

  const bar = el('div', 'term-bar mono');
  bar.append(el('span', 'muted', 'terminal'));
  const closeBtn = el('button', 'term-close mono', 'Close (Esc)');
  closeBtn.type = 'button';
  bar.append(closeBtn);

  const out = el('div', 'term-out');
  out.setAttribute('role', 'log');
  out.setAttribute('aria-live', 'polite');
  out.setAttribute('aria-relevant', 'additions');

  const form = el('form', 'term-in');
  const ps = el('label', 'term-ps mono');
  ps.htmlFor = 'term-input';
  const input = el('input', 'term-input mono');
  input.id = 'term-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('autocorrect', 'off');
  input.enterKeyHint = 'go';
  form.append(ps, input);
  dialog.append(bar, out, form);

  const paintPrompt = () => { ps.textContent = prompt(location.pathname); };
  paintPrompt();

  const write = (line: Line) => {
    const p = el('p', 't-line');
    for (const seg of line) {
      if (seg.tone) { const s = el('span', `t-${seg.tone}`, seg.text); p.append(s); } else p.append(document.createTextNode(seg.text));
    }
    out.append(p);
  };
  const flush = () => { out.scrollTop = out.scrollHeight; };

  // The page behind must not take focus or clicks while the dialog is open.
  const inerted: HTMLElement[] = [...document.body.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
  inerted.forEach((c) => { c.inert = true; });
  document.body.append(dialog);

  const onDocKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close?.(); } };
  const onSwap = () => close?.(false); // the page is about to be replaced; do not steal focus afterwards
  document.addEventListener('keydown', onDocKey);
  document.addEventListener('astro:before-swap', onSwap);

  close = (restoreFocus = true) => {
    document.removeEventListener('keydown', onDocKey);
    document.removeEventListener('astro:before-swap', onSwap);
    dialog.remove();
    inerted.forEach((c) => { c.inert = false; });
    close = null;
    if (restoreFocus) returnTo?.focus();
  };
  closeBtn.addEventListener('click', () => close?.());

  // Focus trap: Tab and Shift+Tab cycle between the close button and the input.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const active = document.activeElement;
    if (input.value.trim() && active === input && !e.shiftKey) {
      e.preventDefault();
      const r = complete(input.value, data);
      input.value = r.value;
      if (r.options.length) { write([{ text: r.options.join('  '), tone: 'muted' }]); flush(); }
      return;
    }
    const order = [closeBtn, input];
    const i = order.indexOf(active as HTMLElement);
    const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
    e.preventDefault();
    next.focus();
  });

  // History: up and down walk previous commands.
  let cursor = history.length;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); cursor = Math.max(0, cursor - 1); input.value = history[cursor] ?? ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(history.length, cursor + 1); input.value = history[cursor] ?? ''; }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value.trim();
    input.value = '';
    if (!line) return;
    history.push(line);
    cursor = history.length;
    write([{ text: `${ps.textContent} `, tone: 'ok' }, { text: line }]);

    const result = run(line, { data, history, tier: document.documentElement.dataset.tier ?? 'C' });
    result.lines.forEach(write);
    flush();
    const a = result.action;
    if (a?.type === 'clear') out.replaceChildren();
    else if (a?.type === 'exit') close?.();
    else if (a?.type === 'navigate') { close?.(false); navigate(a.url); }
  });

  input.focus();
  write([{ text: "type 'help' for commands. Esc closes.", tone: 'muted' as Tone }]);
  await load();
  if (!data) write([{ text: 'data unavailable: /terminal.json could not be loaded', tone: 'risk' }]);
}
