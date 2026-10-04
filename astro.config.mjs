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
  build: { inlineStylesheets: 'auto' },
});
