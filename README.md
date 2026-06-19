# 我的个人网站

Astro + Tailwind 搭建的个人作品集 + 博客，暗黑科技风。
你只需在 Obsidian 里写文章，网站负责展示。

## 本地预览

```bash
npm install      # 第一次用，安装依赖
npm run dev      # 启动本地预览，打开 http://localhost:4321
```

改完想看正式效果：

```bash
npm run build    # 生成静态网站到 dist/
npm run preview  # 预览构建结果
```

## 怎么发新文章（重点）

你在 **Obsidian** 里写好文章后，把这个 `.md` 文件放进：

```
src/content/blog/
```

文件开头需要有一小段 frontmatter（Obsidian 里就是文档最顶部的属性）：

```markdown
---
title: 文章标题
date: 2026-06-19
description: 一句话摘要（可选，显示在列表里）
tags: [嵌入式, C语言]   # 可选
draft: false            # 可选，true = 草稿，不显示
---

正文从这里开始，正常写 Markdown 就行。
```

保存后，网站会自动生成对应页面，出现在「博客」列表里。**你不需要碰任何代码。**

### 用文件夹分类（重点）

`src/content/blog/` 下面**建子文件夹就是分类**，文件夹名 = 分类名：

```
src/content/blog/
├── 嵌入式/
│   ├── 点亮一颗LED.md
│   └── 串口通信.md
├── 笔记/
│   └── RTOS任务调度.md
└── 随手记.md          ← 直接放根目录的，归到「未分类」
```

网站会：
- 在「博客」页按分类分组列出文章
- 生成「分类」页（`/categories`）供按分类浏览
- 每篇文章顶部显示它所属的分类

**两个重要特性：**
1. **网址不带文件夹**：文章网址永远是 `/blog/文件名`，不管它在哪个文件夹。所以你以后把文章在文件夹间挪动，网址不会变、链接不会失效。
2. **因此文件名要唯一**：不同文件夹里不能有同名文件（否则网址会撞车，构建时会报错提醒你改名）。

> 想手动指定分类、不跟文件夹走？在 frontmatter 里加一行 `category: 自定义分类名` 即可覆盖。

> 进阶：可以把 Obsidian 的某个文件夹直接同步到 `src/content/blog/`，
> 连子文件夹结构一起同步，这样在 Obsidian 保存即更新。需要的话告诉我，我帮你配。

### Obsidian 双链语法（已支持）
你从 Obsidian 复制过来几乎不用改语法：

- **图片**：`![[图片名.png]]` 或 `![[图片名.png|说明文字]]`
  把图片放进 `public/blog-assets/` 文件夹即可。
- **内部链接**：`[[文件名]]` 或 `[[文件名|显示文字]]`
  注意：按**文件名**链接，不是文章标题。比如链到 `rtos-scheduling.md` 就写 `[[rtos-scheduling]]`。

代码块右上角会自动出现「复制」按钮，无需任何操作。

## 怎么加项目

在 `src/content/projects/` 里新建一个 `.md` 文件：

```markdown
---
title: 项目名称
description: 一句话描述
order: 1              # 排序，数字越小越靠前
stack: [STM32, C, FreeRTOS]
repo: https://github.com/...   # 可选
link: https://...              # 可选，演示地址
---

项目详细介绍，Markdown 格式。
```

## 怎么加荣誉证书

证书显示在「关于」页底部。两步：

1. 把证书照片/扫描件放进 `public/certs/` 文件夹。
2. 在 `src/content/awards/` 里新建一个 `.md` 文件：

```markdown
---
title: 全国大学生电子设计竞赛   # 奖项名称
issuer: 教育部高等教育司         # 颁发方（可选）
date: 2025-10-15                # 获奖时间
level: 省级一等奖               # 等级/名次（可选）
image: my-cert.jpg             # 证书图片文件名（对应 public/certs/ 里的文件）
order: 1                       # 排序，数字越小越靠前（可选，不填按时间倒序）
---
```

证书会以卡片展示，访客**点击图片可全屏放大查看**。没有证书时，「关于」页不显示这个板块。

## 怎么改个人信息

| 想改什么 | 改哪个文件 |
|---------|-----------|
| 名字、简介、邮箱、社交链接、导航 | `src/config.ts` |
| 「关于」页的技能栈、经历时间线 | `src/pages/about.astro` |
| 配色 / 字体 | `tailwind.config.mjs` |

## 简历下载

把简历 PDF 放进 `public/` 文件夹（比如 `public/resume.pdf`），
然后在 `src/config.ts` 里设置 `resume: 'resume.pdf'`，
「关于」页就会出现「下载简历 PDF」按钮。留空则不显示。

## 评论系统（giscus）

博客文章底部可以有评论区，基于你的 GitHub 仓库，免费、无需后台。开启步骤：

1. 把代码仓库设为 **public**，并在仓库 Settings → General → Features 里勾选 **Discussions**。
2. 打开 [giscus.app](https://giscus.app)，填入你的仓库，它会生成 `repo-id`、`category-id`。
3. 把这些值填进 `src/config.ts` 里的 `giscus` 配置。
4. 填好后评论区自动出现；不填则不显示。

## 其他自动功能

- **RSS 订阅**：`/rss.xml`（页脚有入口），别人可订阅你的更新。
- **站点地图**：`/sitemap-index.xml`，帮搜索引擎收录。
- **分类页**：`/categories`，按文件夹分类浏览文章。
- **标签页**：`/tags`，文章按标签分类浏览。
- **文章目录、阅读时长、上一篇/下一篇**：博客文章页自动生成。
- **404 页面**：访问不存在的地址时显示。

> 注意：RSS / sitemap / SEO 依赖正确的网址。部署前把 `astro.config.mjs` 里的
> `site: 'https://example.com'` 改成你的真实域名。

## 部署上线

### 方式一：Vercel（最简单）
1. 把代码推到 GitHub 仓库。
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录，Import 这个仓库。
3. Vercel 自动识别 Astro，点 Deploy 即可，几十秒后就有网址。
4. 之后每次往 GitHub 推送，网站自动更新。

### 方式二：GitHub Pages
1. 在 `astro.config.mjs` 里设置 `site` 和 `base`（部署到 `用户名.github.io/仓库名` 时需要 `base: '/仓库名'`）。
2. 仓库里加一个 GitHub Actions 工作流（需要的话我帮你生成）。

需要我帮你配置具体哪一种，告诉我就行。

## 目录结构

```
src/
  config.ts            # 站点全局配置（名字、链接等）
  content/
    blog/              # ← 你的文章放这里
    projects/          # ← 你的项目放这里
    config.ts          # 文章/项目的字段定义
  layouts/             # 页面骨架
  components/          # 页头、页脚
  pages/               # 各个页面
  styles/global.css    # 全局样式
```
