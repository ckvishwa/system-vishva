import { expect, type Page } from '@playwright/test';

/**
 * Test-only instrumentation, injected before any page script runs:
 *  - __frames: every requestAnimationFrame callback that actually ran (the scheduler is the only caller)
 *  - __gl: WebGL contexts created for #system-environment, and how many were lost since
 * Also forces tier A so the scene mounts regardless of the CI machine's core count.
 */
export async function instrument(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const w = window as any;
    w.__frames = 0;
    w.__gl = { created: 0, lost: 0 };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { w.__frames++; cb(t); });
    const seen = new WeakSet<HTMLCanvasElement>();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
      const ctx = (getContext as any).call(this, type, ...rest);
      if (ctx && type.startsWith('webgl') && this.id === 'system-environment' && !seen.has(this)) {
        seen.add(this);
        w.__gl.created++;
        this.addEventListener('webglcontextlost', () => { w.__gl.lost++; });
      }
      return ctx;
    } as typeof getContext;
  });
}

export const live = (page: Page) => expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 15_000 });

