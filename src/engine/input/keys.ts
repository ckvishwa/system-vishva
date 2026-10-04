/**
 * Keyboard shortcuts (the terminal's "/" and "`"). One listener, ignored while typing in a field and when a
 * modifier is held, so it never fights the browser or assistive tech. This is the only keyboard listener
 * outside the terminal itself; effects never read the keyboard.
 */
export function onShortcut(keys: string[], cb: () => void): () => void {
  const h = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !keys.includes(e.key)) return;
    const t = e.target as Element | null;
    if (t?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"]')) return;
    e.preventDefault();
    cb();
  };
  addEventListener('keydown', h);
  return () => removeEventListener('keydown', h);
}
