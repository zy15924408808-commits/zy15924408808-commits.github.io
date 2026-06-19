import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { remarkObsidian } from './src/plugins/remark-obsidian.mjs';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages 用户主站地址（仓库名改为 用户名.github.io 后即为根目录）
  site: 'https://zy15924408808-commits.github.io',
  integrations: [tailwind(), sitemap()],
  markdown: {
    remarkPlugins: [remarkObsidian],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
