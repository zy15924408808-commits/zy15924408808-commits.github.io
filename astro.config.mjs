import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { remarkObsidian } from './src/plugins/remark-obsidian.mjs';

// https://astro.build/config
export default defineConfig({
  // 部署上线前，把这里改成你的真实网址（RSS、sitemap、SEO 都依赖它）
  site: 'https://example.com',
  integrations: [tailwind(), sitemap()],
  markdown: {
    remarkPlugins: [remarkObsidian],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
