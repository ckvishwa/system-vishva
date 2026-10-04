// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// D-01 static output · D-11 deploy static to Vercel
export default defineConfig({
  site: 'https://vishva.dev', // TODO: replace with the real domain
  output: 'static',
  integrations: [mdx(), sitemap()],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // Strict CSP: no inline <style> and no inlined scripts. The only inline code is the pre-paint tier script, allowed by hash.
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
});
