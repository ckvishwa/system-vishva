// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// The public origin comes from the environment, never a guess: SITE_URL (a real domain, once there is one), else the
// Vercel production URL when the build runs on Vercel. With neither, `site` is unset and canonical/OG URLs are left out.
const host = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

// D-01 static output · D-11 deploy static to Vercel
export default defineConfig({
  site: host,
  output: 'static',
  integrations: [mdx(), sitemap()],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // Strict CSP: no inline <style> and no inlined scripts. The only inline code is the pre-paint tier script, allowed by hash.
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
});
