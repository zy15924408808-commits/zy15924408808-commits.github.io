// 站点全局配置 —— 想改名字、简介、社交链接，改这里就行
export const site = {
  // 你的名字
  name: 'wind',
  // 一句话定位，显示在首页和页脚
  tagline: '嵌入式开发学习者 · 正在路上',
  // 首页副标题
  intro: '大二在读，专注嵌入式与底层开发。在这里记录我的项目、笔记与成长。',
  // 邮箱
  email: '511442884@qq.com',
  // 社交链接（不需要的留空字符串即可，会自动隐藏）
  social: {
    github: 'https://github.com/zy15924408808-commits',
    bilibili: 'https://space.bilibili.com/1820949289',
    zhihu: '',
  },
  // 简历 PDF：把文件放进 public/，这里写文件名；留空则「关于」页不显示下载按钮
  resume: '', // 例如 'resume.pdf'
};

// 评论系统 giscus（基于 GitHub Discussions，免费、无后台）
// 配置步骤见 README。填好下面 4 项后，博客文章底部会自动出现评论区。
// 留空 repo 则不显示评论。
export const giscus = {
  repo: '', // 例如 'wind/my-website'
  repoId: '',
  category: 'Announcements',
  categoryId: '',
};

// 导航栏
export const nav = [
  { label: '首页', href: '/' },
  { label: '关于', href: '/about' },
  { label: '项目', href: '/projects' },
  { label: '博客', href: '/blog' },
  { label: '联系', href: '/contact' },
];
