import { defineCollection, z } from 'astro:content';

// 博客文章集合：你在 Obsidian 写的 .md 文件放进 src/content/blog/ 即可
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // 文章日期，建议 Obsidian 里写 date: 2026-06-19
    date: z.coerce.date(),
    // 可选：一句话摘要，显示在博客列表
    description: z.string().optional(),
    // 可选：标签，例如 [嵌入式, C语言, RTOS]
    tags: z.array(z.string()).default([]),
    // 可选：手动指定分类，覆盖文件夹推断出的分类
    category: z.string().optional(),
    // 可选：设为 true 可隐藏（草稿）
    draft: z.boolean().default(false),
  }),
});

// 项目集合：每个项目一个 .md 文件，放进 src/content/projects/
const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // 排序权重，数字越小越靠前
    order: z.number().default(99),
    // 技术栈标签，例如 [STM32, FreeRTOS, C]
    stack: z.array(z.string()).default([]),
    // 可选：项目链接（GitHub、演示等）
    link: z.string().optional(),
    repo: z.string().optional(),
  }),
});

// 荣誉证书集合：每张证书一个 .md 文件，放进 src/content/awards/
const awards = defineCollection({
  type: 'content',
  schema: z.object({
    // 证书/奖项名称
    title: z.string(),
    // 颁发方，例如 "中国大学生计算机设计大赛组委会"
    issuer: z.string().optional(),
    // 获奖时间
    date: z.coerce.date(),
    // 证书图片文件名，放进 public/certs/，例如 "award1.jpg"
    image: z.string().optional(),
    // 等级/名次，例如 "国家级一等奖"
    level: z.string().optional(),
    // 排序权重，数字越小越靠前；不填则按时间倒序
    order: z.number().optional(),
  }),
});

export const collections = { blog, projects, awards };
