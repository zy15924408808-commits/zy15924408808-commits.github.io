import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../config';
import { postSlug } from '../utils/blog';

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: `${site.name} 的博客`,
    description: site.intro,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description ?? '',
      link: `/blog/${postSlug(post)}/`,
    })),
    customData: `<language>zh-cn</language>`,
  });
}
