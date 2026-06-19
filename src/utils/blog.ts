import type { CollectionEntry } from 'astro:content';

type BlogEntry = CollectionEntry<'blog'>;

const UNCATEGORIZED = '未分类';

/**
 * 文章网址用的扁平 slug：只取文件名，忽略所在文件夹。
 * 例如 "嵌入式/hello-embedded" → "hello-embedded"
 * 这样把文章在文件夹间移动时，网址不会变。
 */
export function postSlug(post: BlogEntry): string {
  const parts = post.slug.split('/');
  return parts[parts.length - 1];
}

/**
 * 文章分类：取所在文件夹名；直接放在 blog/ 根目录的归为「未分类」。
 * 也可以在 frontmatter 里写 category 来手动覆盖。
 * 例如 "嵌入式/hello-embedded" → "嵌入式"
 */
export function postCategory(post: BlogEntry): string {
  if (post.data.category) return post.data.category;
  const parts = post.slug.split('/');
  return parts.length > 1 ? parts[parts.length - 2] : UNCATEGORIZED;
}

/** 文章网址 */
export function postUrl(post: BlogEntry): string {
  return `/blog/${postSlug(post)}`;
}

/** 日期格式化（列表用） */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 按分类把文章分组，返回 [分类, 文章[]][]，「未分类」排最后 */
export function groupByCategory(posts: BlogEntry[]): [string, BlogEntry[]][] {
  const map = new Map<string, BlogEntry[]>();
  for (const post of posts) {
    const cat = postCategory(post);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(post);
  }
  return [...map.entries()].sort((a, b) => {
    if (a[0] === UNCATEGORIZED) return 1;
    if (b[0] === UNCATEGORIZED) return -1;
    return b[1].length - a[1].length;
  });
}

export { UNCATEGORIZED };
