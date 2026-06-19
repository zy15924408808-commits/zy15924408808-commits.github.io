import { visit } from 'unist-util-visit';

/**
 * 让 Obsidian 的双链语法在网站里直接可用：
 *   ![[图片.png]]          → 图片（从 /blog-assets/ 读取）
 *   ![[图片.png|说明]]      → 带 alt 的图片
 *   [[文章标题]]            → 链接到 /blog/文章标题(转为 slug)
 *   [[文章标题|显示文字]]    → 自定义显示文字的链接
 *
 * 图片默认从 public/blog-assets/ 读取，所以把 Obsidian 附件
 * 放进网站的 public/blog-assets/ 文件夹即可。
 */

const IMAGE_BASE = '/blog-assets/';

// 把标题转成 URL slug：小写、空格转连字符
function toSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-龥-]/g, '');
}

const WIKILINK = /(!?)\[\[([^\]]+)\]\]/g;

export function remarkObsidian() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;
      const value = node.value;
      if (!value.includes('[[')) return;

      const children = [];
      let lastIndex = 0;
      let match;
      WIKILINK.lastIndex = 0;

      while ((match = WIKILINK.exec(value)) !== null) {
        const [full, bang, inner] = match;
        const start = match.index;

        // 匹配前的普通文字
        if (start > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, start) });
        }

        const [targetRaw, labelRaw] = inner.split('|').map((s) => s.trim());

        if (bang === '!') {
          // 图片
          children.push({
            type: 'image',
            url: IMAGE_BASE + targetRaw,
            alt: labelRaw ?? targetRaw,
            title: null,
          });
        } else {
          // 内部链接
          const label = labelRaw ?? targetRaw;
          children.push({
            type: 'link',
            url: `/blog/${toSlug(targetRaw)}`,
            children: [{ type: 'text', value: label }],
          });
        }

        lastIndex = start + full.length;
      }

      // 剩余文字
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }

      if (children.length > 0) {
        parent.children.splice(index, 1, ...children);
        return index + children.length;
      }
    });
  };
}
