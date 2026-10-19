const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  box:'<path d="m12 2 10 5-10 5L2 7l10-5ZM2 7v10l10 5 10-5V7M12 12v10M7 4.5l10 5"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-6-6L3 21"/>',
  settings:'<path d="m9 3 1-1h4l1 3 3 1 3 2-1 4 1 4-3 2-3 1-1 3h-4l-1-3-3-1-3-2 1-4-1-4 3-2 3-1z"/><circle cx="12" cy="12" r="3"/>',
  git:'<circle cx="6" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 8v8M18 9v1a5 5 0 0 1-5 5H6"/>',
  external:'<path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a3.5 3.5 0 0 0-5-5L4 14v6ZM12 21h9"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 15v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  check:'<path d="m5 12 4 4L19 6"/>', refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 2v4M18 4h4"/>',
  branch:'<path d="M6 6v12M18 7v3c0 4-12 2-12 6"/><circle cx="6" cy="3" r="3"/><circle cx="6" cy="21" r="2"/><circle cx="18" cy="4" r="3"/>',
  code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  link:'<path d="m10 13 4-4M8 15l-2 2a3 3 0 0 0 4 4l4-4a3 3 0 0 0-1-5M16 9l2-2a3 3 0 0 0-4-4l-4 4a3 3 0 0 0 1 5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`;
$$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const titles = { dashboard:'概览', profile:'个人资料', blog:'博客文章', projects:'项目作品', awards:'荣誉证书', media:'素材库', settings:'网站设置', publish:'发布与同步', editor:'内容编辑' };
const contentNames = { blog:'文章', projects:'项目', awards:'证书' };
const state = { token:'', settings:null, content:{blog:[],projects:[],awards:[]}, media:[], git:null, page:'dashboard', dirty:false, editor:null, job:null, filter:'', category:'', mediaBucket:'all', previewing:false };
let toastTimer, previewTimer, previewSequence = 0, pollTimer;
let importDraft = null;
async function api(route, options = {}) {
  const response = await fetch(`/api/${route}`, { ...options, headers: { 'Content-Type':'application/json', 'X-Admin-Token':state.token, ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作失败，请稍后重试。');
  return result;
}
const post = (route, body) => api(route, { method:'POST', body:JSON.stringify(body) });
function toast(message, error = false) { clearTimeout(toastTimer); const el = $('#toast'); el.textContent = message; el.className = `visible${error ? ' error' : ''}`; toastTimer = setTimeout(() => el.className = '', error ? 7500 : 3500); }
function dirty(value = true) { state.dirty = value; const el = $('#save-status'); if (el) { el.textContent = value ? '● 有未保存的修改' : '✓ 已保存到本机'; el.classList.toggle('dirty',value); } }
window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
const unsaved = () => !state.dirty || window.confirm('当前内容还没有保存。确定放弃这些修改吗？');
async function reload() {
  const data = await api('bootstrap'); Object.assign(state, data);
  $('#workspace-name').textContent = `${state.settings.data.site.name} 的个人网站`;
  $('#account-name').textContent = state.settings.data.site.name;
  for (const c of ['blog','projects']) $(`#${c}-count`).textContent = state.content[c].length;
}
function button(label, action, name = '', style = '', attrs = '') { return `<button type="button" class="button ${style}" data-action="${action}" ${attrs}>${name ? icon(name) : ''}${label}</button>`; }
function heading(title, desc, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">YOUR SPACE, YOUR STORIES</div><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`; }
function panel(title, body, description = '', action = '') { return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div>${action}</div><div class="panel-body">${body}</div></section>`; }
function field(label, name, value = '', options = {}) {
  const attrs = `${options.required ? 'required' : ''} ${options.disabled ? 'disabled' : ''} ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ''}`;
  return `<label class="field ${options.full ? 'full' : ''}"><span class="field-label">${label}${options.required ? ' <span class="muted">*</span>' : ''}</span>${options.textarea ? `<textarea name="${name}" ${attrs} rows="${options.rows || 4}">${esc(value)}</textarea>` : `<input type="${options.type || 'text'}" name="${name}" value="${esc(value)}" ${attrs}>`}${options.hint ? `<span class="field-hint">${options.hint}</span>` : ''}</label>`;
}
const empty = (title, desc = '') => `<div class="empty">${icon('file')}<strong>${title}</strong>${desc}</div>`;
function repoName() { return (state.git?.remote || '').replace(/^https:\/\/github.com\//,'').replace(/^git@github.com:/,'').replace(/\.git$/,''); }
function statusBadge(entry) { return entry.error ? '<span class="badge draft">格式异常</span>' : entry.data.draft ? '<span class="badge draft">草稿</span>' : '<span class="badge"><span class="dot"></span>可发布</span>'; }
const cat = entry => entry.data.category || (entry.path.includes('/') ? entry.path.split('/').at(-2) : '未分类');
function dashboard() {
  const today = new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  const posts = state.content.blog;
  const drafts = posts.filter(p => p.data.draft).length;
  const recent = [...posts].sort((a,b) => String(b.data.date || '').localeCompare(String(a.data.date || ''))).slice(0,5);
  const stats = [['博客文章',posts.length,'篇',`${drafts} 篇草稿，${posts.length - drafts} 篇可发布`,'file'],['项目作品',state.content.projects.length,'个','记录每一次动手实践','box'],['荣誉证书',state.content.awards.length,'项','每一份努力，都值得记录','award'],['待提交文件',state.git.changes.length,'个',state.git.changes.length ? '修改已在本机，等待你的发布' : '工作区文件与本地提交一致','git']];
  return heading(`你好，${esc(state.settings.data.site.name)} <span class="muted">/</span>`, '欢迎回到你的内容工作台，今天也留下点新的想法吧。',button('新建文章','new','plus','primary','data-collection="blog"')) +
    `<section class="hero"><div><div class="date-chip">${icon('clock')}${today}</div><h2>每一次记录，都是成长的印记。</h2><p>管理你的项目、分享你的思考，让个人网站持续生长。</p><div class="hero-actions">${button('开始写作','new','edit','primary small','data-collection="blog"')}${button('编辑个人资料','navigate','user','ghost small','data-page="profile"')}</div></div><div class="hero-mark">${icon('code')}</div></section>` +
    `<div class="stats">${stats.map(([label,value,unit,note,i]) => `<div class="stat"><div class="stat-top">${label}${icon(i)}</div><div class="stat-number">${value}<span>${unit}</span></div><div class="stat-note"><span class="dot"></span>${note}</div></div>`).join('')}</div>` +
    `<div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>最近的文章</h2><p>灵感与技术，慢慢积累。</p></div><a class="button link" href="#blog">全部文章 ${icon('arrow')}</a></div>${recent.length ? `<table class="content-table"><thead><tr><th>文章标题</th><th>状态</th><th>文章日期</th><th></th></tr></thead><tbody>${recent.map(p => `<tr><td><div class="entry-title"><span class="entry-icon">${icon('file')}</span><div class="entry-text"><strong title="${esc(p.data.title)}">${esc(p.data.title)}</strong><small>${esc(cat(p))} · ${p.words || 0} 字</small></div></div></td><td>${statusBadge(p)}</td><td><span class="table-date">${esc(p.data.date || '—')}</span></td><td><button class="table-button" aria-label="编辑 ${esc(p.data.title)}" data-action="edit" data-collection="blog" data-path="${esc(p.path)}">${icon('edit')}</button></td></tr>`).join('')}</tbody></table>` : empty('还没有文章','点击「开始写作」，记录你的第一个想法。')}</section><div class="dashboard-side"><section class="panel publish-card"><div class="panel-head"><h2>发布状态</h2>${icon('git')}</div><div class="panel-body"><div class="connection-label"><span class="dot"></span>已配置 GitHub 仓库</div><p class="repo-name">${esc(repoName())}</p><div class="repo-details"><span>${icon('branch')}${esc(state.git.branch || '未选择分支')}</span><span>GitHub Pages</span></div><div class="sync-note">${icon('check')}<div><strong>${state.git.changes.length ? `${state.git.changes.length} 个文件等待提交` : '本地文件已提交'}</strong><small>${state.git.ahead ? `有 ${state.git.ahead} 个本地提交待推送` : '保存 → 构建检查 → 提交与推送'}</small></div></div>${button('准备发布','navigate','upload','primary full','data-page="publish"')}</div></section>${panel('快捷操作',`<button class="quick-item" data-action="new" data-collection="projects"><span>${icon('box')}</span><span><strong>添加新项目</strong><small>展示你的下一件作品</small></span><span>↗</span></button><button class="quick-item" data-action="navigate" data-page="media"><span>${icon('image')}</span><span><strong>上传图片素材</strong><small>博客、项目与证书配图</small></span><span>↗</span></button><button class="quick-item" data-action="navigate" data-page="profile"><span>${icon('user')}</span><span><strong>更新个人资料</strong><small>让大家更了解现在的你</small></span><span>↗</span></button>`)}</div></div><div class="hint-strip">${icon('spark')}<span>灵感随时发生。文章可以先存为草稿，准备好了再展示给大家。</span><a href="#blog">管理草稿 →</a></div>`;
}
function skillRows(skills) { return skills.map((s,i) => `<div class="repeater-row">${field('技能分组',`skill-group-${i}`,s.group)}${field('技能（用逗号分隔）',`skill-items-${i}`,s.items.join(', '))}${button('','remove-row','trash','ghost icon-only','aria-label="删除技能分组"')}</div>`).join(''); }
function timelineRows(items) { return items.map((t,i) => `<div class="timeline-row">${field('时间',`time-${i}`,t.time)}${field('经历标题',`title-${i}`,t.title)}${button('','remove-row','trash','ghost icon-only','aria-label="删除经历"')}${field('经历描述',`desc-${i}`,t.desc,{textarea:true,rows:2})}</div>`).join(''); }
function profile() {
  const { site, about } = state.settings.data;
  return `<form id="settings-form" data-mode="profile">${heading('个人资料','让访客认识你，也记录你走过的路。',`<span id="save-status" class="save-status">✓ 已保存到本机</span><button class="button primary" type="submit">${icon('check')}保存资料</button>`)}<div class="form-layout"><div>${panel('基本信息',`<div class="fields">${field('显示名字','name',site.name,{required:true})}${field('一句话定位','tagline',site.tagline)}${field('首页简介','intro',site.intro,{textarea:true,full:true,rows:3})}${field('联系邮箱','email',site.email,{type:'email'})}${field('GitHub 主页','github',site.social.github,{type:'url'})}${field('Bilibili 主页','bilibili',site.social.bilibili,{type:'url'})}${field('简历文件路径','resume',site.resume,{hint:'从素材库上传 PDF 后，将路径填入此处。留空隐藏下载按钮。',placeholder:'resumes/我的简历.pdf'})}</div>`)}${panel('关于我的详细介绍',field('个人简介（空行分隔段落）','paragraphs',about.paragraphs.join('\n\n'),{textarea:true,rows:7,full:true}))}${panel('技能栈',`<div id="skill-rows">${skillRows(about.skills)}</div>${button('添加技能分组','add-skill','plus','ghost small')}`)}${panel('成长经历',`<div id="timeline-rows">${timelineRows(about.timeline)}</div>${button('添加一段经历','add-timeline','plus','ghost small')}`)}</div><aside class="form-aside">${panel('内容会显示在哪里？','<div class="form-note"><strong>首页与页脚</strong>名字、定位与首页简介会同步到网站的相关位置。</div><div class="form-note"><strong>关于页面</strong>详细介绍、技能栈、成长经历与简历下载。</div><div class="form-note"><strong>联系页面</strong>邮箱与社交平台链接。留空的联系方式会自动隐藏。</div>')}${panel('保存与发布','<p class="form-note">保存会更新本机文件。确认预览效果后，前往「发布与同步」推送到 GitHub。</p>')}</aside></div></form>`;
}
function settingsPage() {
  const { nav, giscus } = state.settings.data;
  return `<form id="settings-form" data-mode="settings">${heading('网站设置','调整导航与评论，让你的网站更顺手。',`<span id="save-status" class="save-status">✓ 已保存到本机</span><button class="button primary" type="submit">${icon('check')}保存设置</button>`)}<div class="form-layout"><div>${panel('顶部导航',`<div id="nav-rows">${nav.map((n,i) => navRow(n,i)).join('')}</div>${button('添加导航','add-nav','plus','ghost small')}`,'按这里的顺序显示，链接使用 /about 这样的站内路径。')}${panel('博客评论 · giscus',`<div class="fields">${field('仓库（用户名/仓库名）','repo',giscus.repo,{placeholder:'owner/repo'})}${field('Repository ID','repoId',giscus.repoId)}${field('讨论分类','category',giscus.category)}${field('Category ID','categoryId',giscus.categoryId)}</div><p class="form-note" style-placeholder="">留空仓库名称即可关闭评论。配置值可以从 giscus.app 获取。</p>`)}</div><aside class="form-aside">${panel('发布目标',`<p class="form-note"><strong>${esc(repoName())}</strong>当前分支：${esc(state.git.branch)}<br>GitHub Pages 由 main 分支推送触发。</p>`)}</aside></div></form>`;
}
function navRow(n, i) { return `<div class="repeater-row">${field('导航名称',`nav-label-${i}`,n.label,{required:true})}${field('站内路径',`nav-href-${i}`,n.href,{required:true})}${button('','remove-row','trash','ghost icon-only','aria-label="删除导航"')}</div>`; }
function contentList(collection) {
  const name = contentNames[collection];
  return heading(titles[collection],{blog:'把学习过程写下来，让知识成为自己的。',projects:'记录从想法到实现的每一步，展示你的作品。',awards:'管理关于页面中的荣誉与证书。'}[collection],(collection === 'blog' ? button('导入电脑文章','import','upload','ghost') : '') + button(`新建${name}`,'new','plus','primary',`data-collection="${collection}"`)) + `<section class="panel"><div class="toolbar"><input id="content-search" aria-label="搜索内容" placeholder="搜索标题、分类或标签…" value="${esc(state.filter)}">${collection === 'blog' ? `<select id="draft-filter" aria-label="筛选状态"><option value="">全部状态</option><option value="published">可发布</option><option value="draft">草稿</option></select>` : ''}<span class="right">共 ${state.content[collection].length} ${collection === 'blog' ? '篇' : '项'}内容</span></div><div id="list-results">${listItems(collection)}</div></section>`;
}
function listItems(collection) {
  const keyword = state.filter.toLowerCase();
  const entries = [...state.content[collection]].filter(p => [p.data.title,p.data.description,cat(p),...(p.data.tags || []),...(p.data.stack || [])].join(' ').toLowerCase().includes(keyword)).filter(p => !state.category || (state.category === 'draft' ? p.data.draft : !p.data.draft)).sort((a,b) => collection === 'blog' ? String(b.data.date || '').localeCompare(String(a.data.date || '')) : (a.data.order ?? 99) - (b.data.order ?? 99));
  return entries.length ? entries.map(p => `<article class="list-card"><span class="entry-icon">${icon({blog:'file',projects:'box',awards:'award'}[collection])}</span><div class="list-info"><strong>${esc(p.data.title)}</strong><p>${esc(p.error || p.data.description || p.data.issuer || '暂无摘要')}</p><div class="list-meta">${collection === 'blog' ? `${statusBadge(p)}<span>${esc(cat(p))}</span><span>${esc(p.data.date)}</span>` : `<span>${esc((p.data.stack || []).join(' · ') || p.data.level || '')}</span>`}<span>${esc(p.path)}</span></div></div><div class="actions">${button('编辑','edit','edit','ghost small',`data-collection="${collection}" data-path="${esc(p.path)}"`)}${button('','delete','trash','ghost icon-only',`aria-label="删除 ${esc(p.data.title)}" data-collection="${collection}" data-path="${esc(p.path)}"`)}</div></article>`).join('') : empty('这里还没有内容','试试新建内容，或者更换搜索条件。');
}
function editorPage() {
  const e = state.editor, d = e.data, c = e.collection, name = contentNames[c];
  const attributes = c === 'blog' ? `${field('文章日期','date',d.date,{type:'date',required:true})}${field('分类','category',d.category || (e.path?.includes('/') ? e.path.split('/').at(-2) : ''),{placeholder:'例如：嵌入式'})}${field('标签（逗号分隔）','tags',(d.tags || []).join(', '))}<label class="checkbox-label"><input type="checkbox" name="draft" ${d.draft ? 'checked' : ''}>存为草稿（前台隐藏）</label><p class="field-hint">草稿仍会随 Git 一同提交到仓库。</p>` : c === 'projects' ? `${field('技术栈（逗号分隔）','stack',(d.stack || []).join(', '))}${field('排序（越小越靠前）','order',d.order ?? 99,{type:'number'})}${field('代码仓库','repo',d.repo || '',{type:'url'})}${field('演示链接','link',d.link || '',{type:'url'})}` : `${field('颁发机构','issuer',d.issuer || '')}${field('获奖日期','date',d.date || '',{type:'date'})}${field('奖项等级','level',d.level || '')}${field('排序（越小越靠前）','order',d.order ?? '',{type:'number'})}`;
  return `<form id="editor-form">${heading(e.version ? `编辑${name}` : `新建${name}`,'先保存到本机，再预览和发布。',`${c === 'blog' ? button('导入电脑文章','import','upload','ghost') : ''}${button('返回列表','back','arrow','ghost')}<span class="save-status" id="save-status">${e.version ? '✓ 已保存到本机' : '● 新建内容'}</span><button class="button primary" type="submit">${icon('check')}保存${name}</button>`)}<div class="editor-grid"><div>${panel('基本信息',`<div class="fields">${field(`${name}标题`,'title',d.title,{required:true,full:true,placeholder:'给这次记录起个名字'})}${field('网站内保存位置','path',e.path || '',{required:true,disabled:!!e.version,full:true,placeholder:c === 'blog' ? '嵌入式/我的第一篇文章.md' : '我的新项目.md',hint:'这里填写网站内的相对路径，用 / 分隔；不要填写以盘符开头的电脑路径。导入已有文章请点击「导入电脑文章」。保存后路径固定。'})}${field('一句话摘要','description',d.description || '',{textarea:true,rows:2,full:true,required:c === 'projects'})}</div>`)}<section class="panel"><div class="panel-head"><h2>Markdown 正文</h2><span class="muted"><small>支持 Obsidian 双链与图片语法</small></span></div><div class="editor-tools">${button('编辑','editor-tab','','tab active','data-tab="edit"')}${button('预览','editor-tab','','tab','data-tab="preview"')}<span class="nav-end"></span>${button('标题','insert','','ghost','data-text="## 小节标题"')}${button('粗体','insert','','ghost','data-text="**重点内容**"')}${button('代码','insert','code','ghost','data-snippet="code"')}${button('上传图片','editor-upload','image','ghost')}</div><textarea class="editor-text" name="body" id="markdown-body" aria-label="Markdown 正文" spellcheck="false">${esc(e.body)}</textarea><iframe id="markdown-preview" class="markdown-frame" sandbox="" title="Markdown 预览" hidden></iframe><div class="editor-footer"><span>MARKDOWN</span><span id="word-count">${e.body.replace(/\s/g,'').length} 字</span></div></section></div><aside>${panel('发布属性',`<div class="stack">${attributes}</div>`)}${c !== 'blog' ? panel('封面图片',`${field('图片文件名','image',d.image || '',{hint:`对应素材库中的「${c === 'projects' ? '项目配图' : '证书图片'}」。`})}${d.image ? `<img class="cover-preview" src="/${c === 'projects' ? 'projects' : 'certs'}/${encodeURIComponent(d.image)}" alt="封面">` : ''}<div class="row wrap">${button('上传封面','cover-upload','upload','ghost small')}${button('选择素材','pick-cover','image','ghost small')}</div>`) : ''}${panel('写作提示','<p class="form-note">使用 <span class="mono">##</span> 添加小节，使用 Markdown 插入图片和代码。点击「预览」可以检查正文排版。<br><br>保存不会立即更新线上网站。</p>')}</aside></div></form>`;
}
function mediaPage() {
  const names = {'blog-assets':'博客配图',projects:'项目配图',certs:'证书图片',resumes:'简历 PDF'};
  const items = state.media.filter(item => state.mediaBucket === 'all' || item.bucket === state.mediaBucket);
  return heading('素材库','给你的文字和作品，加一点画面。') + `<section class="upload-zone">${icon('upload')}<div><h2>上传图片或简历</h2><p>支持 JPG、PNG、GIF、WebP、AVIF；简历支持 PDF，单个文件不超过 10 MB。</p></div><div class="row"><select id="upload-bucket" aria-label="上传目录">${Object.entries(names).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>${button('选择文件','media-upload','plus','primary')}</div></section><div class="toolbar"><select id="media-filter" aria-label="筛选素材"><option value="all">全部素材</option>${Object.entries(names).map(([k,v]) => `<option value="${k}" ${state.mediaBucket === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="right">${items.length} 个文件 · 点击复制用于内容编辑</span></div><div class="media-grid">${items.map(item => `<article class="media-card"><div class="media-thumb">${item.bucket === 'resumes' ? icon('file') : `<img src="${esc(item.url)}" loading="lazy" alt="${esc(item.name)}">`}</div><div class="media-caption"><strong title="${esc(item.name)}">${esc(item.name)}</strong><small>${names[item.bucket]} · ${(item.size/1024).toFixed(0)} KB</small>${button(item.bucket === 'blog-assets' ? '复制 Markdown' : '复制路径','copy-media','link','ghost small',`data-bucket="${item.bucket}" data-name="${esc(item.name)}" data-url="${esc(item.url)}"`)}</div></article>`).join('')}</div>${!items.length ? empty('还没有素材','选择文件，上传第一份素材吧。') : ''}`;
}
function changeList(changes) { return changes.map(c => `<div class="change"><span class="change-code">${esc(c.code)}</span><span class="mono">${esc(c.path)}</span></div>`).join(''); }
function publishPage() {
  const git = state.git;
  return heading('发布与同步','从本机到线上，让新的内容与大家见面。',`${button('刷新清单','refresh-git','refresh','ghost')}${git.actionsUrl ? `<a class="button ghost" href="${esc(git.actionsUrl)}" target="_blank" rel="noopener">${icon('external')}部署记录</a>` : ''}`) + `<div class="publish-grid"><div><section class="panel"><div class="panel-head"><div><h2>待提交的文件 <span class="badge neutral">${git.changes.length}</span></h2><p>一键发布会提交下方所有更改，包括已保存的草稿。</p></div>${icon('git')}</div><div class="changes">${git.changes.length ? changeList(git.changes) : '<div class="empty">没有未提交的文件修改，可以重试推送已有的本地提交。</div>'}</div></section>${panel('发布日志',`<div id="job-status" class="status-line">${icon('clock')}等待开始检查或发布</div><pre id="job-log" class="log">构建检查通过后，才会创建提交并推送到 GitHub。</pre><div id="job-error"></div>`)}</div><div>${panel('发布到 GitHub',`<div class="connection-label"><span class="dot"></span>目标仓库</div><p class="repo-name">${esc(repoName())}</p><p class="form-note">当前分支：<span class="badge neutral">${esc(git.branch || 'detached HEAD')}</span><br>本地领先 ${git.ahead} 个提交，落后 ${git.behind} 个提交（基于本地远端记录）。</p><hr><div class="stack">${field('这次更新了什么？','commit-message','更新网站内容',{placeholder:'例如：新增 STM32 项目与学习笔记'})}${button('一键发布到 GitHub','confirm-publish','upload','primary full')}${button('仅运行构建检查','check-build','shield','ghost full')}</div>`)}<div class="notice">① 保存编辑的内容<br>② 构建检查，确保网站能生成<br>③ 创建本地提交，推送 origin/main<br>④ GitHub Actions 部署，请在「部署记录」查看是否上线</div><p class="form-note">首次推送需要这台电脑已登录 GitHub。推送失败会保留本地提交，处理网络或登录问题后可直接重试。</p></div></div>`;
}
function render() {
  const page = state.page;
  $$('nav [data-page]').forEach(el => el.classList.toggle('active',el.dataset.page === (page === 'editor' ? state.editor.collection : page)));
  $('#breadcrumb').textContent = titles[page];
  $('#main').innerHTML = page === 'dashboard' ? dashboard() : page === 'profile' ? profile() : page === 'settings' ? settingsPage() : page === 'editor' ? editorPage() : page === 'media' ? mediaPage() : page === 'publish' ? publishPage() : contentList(page);
  if (page === 'publish') updateJob();
}
function navigate(page) {
  if (!titles[page] || page === 'editor') return;
  if (!unsaved()) { history.replaceState(null,'',`#${state.page === 'editor' ? state.editor.collection : state.page}`); return; }
  dirty(false); state.page = page; state.filter = ''; state.category = ''; state.previewing = false; previewSequence++; render(); window.scrollTo(0,0);
}
window.addEventListener('hashchange',() => navigate(location.hash.slice(1) || 'dashboard'));
function go(page) { if (location.hash === `#${page}`) navigate(page); else location.hash = page; }
async function openEditor(collection, file) {
  if (!unsaved()) return;
  state.editor = file ? await api(`content?collection=${collection}&path=${encodeURIComponent(file)}`) : {collection,path:'',version:null,data:{title:'',description:'',...(collection === 'blog' ? {date:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10),tags:[],draft:true} : collection === 'projects' ? {stack:[],order:99} : {})},body:collection === 'awards' ? '' : '## 简介\n\n在这里写下你的内容。\n'};
  state.page = 'editor'; state.previewing = false; previewSequence++; dirty(false); render(); window.scrollTo(0,0);
}
function splitTags(value) { return value.split(/[,，\n]/).map(t => t.trim()).filter(Boolean); }
async function saveSettings(form) {
  const data = structuredClone(state.settings.data), f = new FormData(form);
  if (form.dataset.mode === 'profile') {
    for (const key of ['name','tagline','intro','email','resume']) data.site[key] = f.get(key).trim();
    data.site.social = {github:f.get('github').trim(),bilibili:f.get('bilibili').trim()};
    data.about.paragraphs = f.get('paragraphs').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    data.about.skills = $$('#skill-rows .repeater-row').map(row => ({group:$('input',row).value.trim(),items:splitTags($$('input',row)[1].value)}));
    data.about.timeline = $$('#timeline-rows .timeline-row').map(row => ({time:$('input',row).value.trim(),title:$$('input',row)[1].value.trim(),desc:$('textarea',row).value.trim()}));
  } else {
    data.nav = $$('#nav-rows .repeater-row').map(row => ({label:$('input',row).value.trim(),href:$$('input',row)[1].value.trim()}));
    for (const key of ['repo','repoId','category','categoryId']) data.giscus[key] = f.get(key).trim();
  }
  await api('settings',{method:'PUT',body:JSON.stringify({data,version:state.settings.version})});
  dirty(false); await reload(); render(); toast('已保存到本机，发布后同步到线上。');
}
async function saveEditor(form) {
  const f = new FormData(form), e = state.editor, c = e.collection, data = {...e.data};
  data.title = f.get('title').trim(); data.description = f.get('description').trim();
  const name = e.version ? e.path : f.get('path').trim();
  if (c === 'blog') { data.date = f.get('date'); data.tags = splitTags(f.get('tags')); data.draft = f.has('draft'); if (f.get('category').trim()) data.category = f.get('category').trim(); else delete data.category; }
  if (c === 'projects') { data.stack = splitTags(f.get('stack')); for (const key of ['repo','link']) { if (f.get(key).trim()) data[key] = f.get(key).trim(); else delete data[key]; } }
  if (c === 'awards') for (const key of ['issuer','date','level']) { if (f.get(key).trim()) data[key] = f.get(key).trim(); else delete data[key]; }
  if (c !== 'blog') { if (f.get('order') !== '') data.order = Number(f.get('order')); else delete data.order; if (f.get('image').trim()) data.image = f.get('image').trim(); else delete data.image; }
  await post('content',{collection:c,path:name,data,body:f.get('body'),version:e.version});
  dirty(false); await reload(); state.editor = await api(`content?collection=${c}&path=${encodeURIComponent(name)}`); state.previewing = false; render(); toast('内容已保存到本机。');
}
async function renderMarkdown() {
  const sequence = ++previewSequence;
  const body = $('#markdown-body')?.value; if (body === undefined) return;
  const {previewUrl} = await post('render',{body});
  if (sequence !== previewSequence || !$('#markdown-preview')) return;
  // 正文在没有脚本、表单和同源权限的沙箱中显示，不与后台页面共享 DOM。
  $('#markdown-preview').src = previewUrl;
}
function insertText(text) { const editor = $('#markdown-body'); editor.setRangeText(text,editor.selectionStart,editor.selectionEnd,'end'); editor.dispatchEvent(new Event('input',{bubbles:true})); editor.focus(); }
function selectFile(accept) { return new Promise(resolve => { const input = document.createElement('input'); input.type = 'file'; input.accept = accept; input.onchange = () => resolve(input.files[0]); input.oncancel = () => resolve(null); input.click(); }); }
function importDialog(el) {
  if (!unsaved()) return;
  const collection = el?.dataset.collection || 'blog';
  importDraft = {collection};
  showDialog(`<h2>导入电脑文章</h2><p>选择电脑里的 Markdown 文章，自动识别标题、日期、标签和正文，保存到网站作为草稿。原文件保持不变，同名文章会自动另存。</p><div class="stack"><label class="field"><span class="field-label">选择文章（.md，UTF-8，最多 2 MB）</span><input id="import-markdown" type="file" accept=".md,text/markdown"></label><div id="import-summary" class="notice" hidden></div><div id="import-images" hidden><p class="form-note">文章含本地图片，请选择配图，或选择包含这些图片的文件夹（含子文件夹）。只会导入正文引用到的图片。</p><div class="import-pickers"><label class="field"><span class="field-label">选择配图（可多选）</span><input id="import-image-files" type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.avif"></label><label class="field"><span class="field-label">或选择附件文件夹</span><input id="import-image-folder" type="file" webkitdirectory multiple></label></div><p id="import-image-status" class="form-note">尚未选择配图。</p><label class="checkbox-label"><input id="import-allow-missing" type="checkbox">缺失图片稍后补充</label></div><div id="import-error" class="notice error" role="alert" hidden></div></div><p class="form-note">导入后可继续编辑，取消草稿并保存后，前往「发布与同步」一键发布到 GitHub。</p><div class="dialog-actions">${button('取消','close-dialog','','ghost')}${button('导入并保存','do-import','upload','primary','id="import-confirm" disabled')}</div>`);
}
async function prepareSelectedArticle(file) {
  const draft = importDraft = {collection:importDraft?.collection || 'blog',file,files:new Map()};
  $('#import-confirm').disabled = true; $('#import-summary').hidden = true; $('#import-error').hidden = true; $('#import-images').hidden = true;
  for (const id of ['import-image-files','import-image-folder']) $(`#${id}`).value = '';
  $('#import-allow-missing').checked = false; $('#import-image-status').textContent = '尚未选择配图。';
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('文章不能超过 2 MB。');
    const date = new Date(file.lastModified); date.setMinutes(date.getMinutes()-date.getTimezoneOffset());
    let text;
    try { text = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()); }
    catch { throw new Error('无法按 UTF-8 读取文章，请在原编辑器中另存为 UTF-8 编码后导入。'); }
    draft.input = {collection:draft.collection,name:file.name,text,date:date.toISOString().slice(0,10)};
    draft.prepared = await post('import/prepare',draft.input);
    if (importDraft !== draft || !$('#import-summary')) return;
    const p = draft.prepared;
    $('#import-summary').innerHTML = `<strong>${esc(p.data.title)}</strong><br>${p.collection === 'blog' ? `日期：${esc(p.data.date)} · ` : `项目简介：${esc(p.data.description)}<br>`}自动保存为：${esc(p.path)}<br>状态：${p.collection === 'blog' ? '草稿（推送后仍隐藏，需取消草稿并保存）' : '待发布（推送后展示）'}${p.references.length ? `<br>本地图片引用：${p.references.length} 处<div class="import-refs">${p.references.map(ref => `<div>${esc(ref)}</div>`).join('')}</div>` : '<br>没有需要导入的本地图片。'}${p.notes.length ? `<br>${p.notes.map(esc).join('<br>')}` : ''}`;
    $('#import-summary').hidden = false; $('#import-images').hidden = !p.references.length; $('#import-confirm').disabled = false;
  } catch (error) { if (importDraft === draft && $('#import-error')) { $('#import-error').textContent = error.message; $('#import-error').hidden = false; } }
}
function collectImportImages(files) {
  if (!importDraft?.prepared) return;
  for (const file of files) {
    if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(file.name)) continue;
    const key = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
    importDraft.files.set(key,file);
  }
  $('#import-image-status').textContent = `已选择 ${importDraft.files.size} 张图片。只复制正文引用的图片；同名歧义会提示处理。`;
}
async function completeImport() {
  if (!importDraft?.prepared) return;
  const draft = importDraft, controls = $$('input,button', $('#modal-content'));
  controls.forEach(el => el.disabled = true); $('#import-error').hidden = true;
  try {
    const names = new Set(draft.prepared.references.map(ref => { try { return decodeURIComponent(ref.split(/[?#]/)[0]).replace(/\\/g,'/').split('/').pop().toLowerCase(); } catch { return ref.split('/').pop().toLowerCase(); } }));
    const assets = [];
    let bytes = 0;
    for (const [path,file] of draft.files) {
      if (!names.has(file.name.toLowerCase())) continue;
      bytes += file.size;
      if (file.size > 10*1024*1024 || bytes > 11*1024*1024) throw new Error('本次引用的图片过大，请压缩后再导入（单张不超过 10 MB）。');
      assets.push({path,base64:await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('无法读取图片：'+file.name)); reader.readAsDataURL(file); })});
    }
    const payload = {...draft.input,assets,allowMissing:$('#import-allow-missing').checked};
    if (new Blob([JSON.stringify(payload)]).size > 15*1024*1024) throw new Error('文章和图片总大小超过导入限制，请压缩图片后重试。');
    const result = await post('import',payload);
    $('#modal').close(); importDraft = null; dirty(false); await reload(); await openEditor(result.collection,result.path);
    if (result.missing.length) $('#editor-form').insertAdjacentHTML('afterbegin',`<div class="notice warning">文章已导入，以下图片需要补充：${result.missing.map(esc).join('、')}。可以使用正文工具栏的「上传图片」替换原链接。</div>`);
    toast(`已导入${result.collection === 'projects' ? '项目' : '文章'}和 ${result.images} 张图片${result.collection === 'blog' ? '，保存为草稿' : '，可检查后发布'}。`);
  } catch (error) { $('#import-error').textContent = error.message; $('#import-error').hidden = false; }
  finally { controls.forEach(el => { if (el.isConnected) el.disabled = false; }); }
}
async function upload(bucket, use) {
  const file = await selectFile(bucket === 'resumes' ? '.pdf' : '.png,.jpg,.jpeg,.gif,.webp,.avif');
  if (!file) return;
  if (file.size > 10*1024*1024) throw new Error('单个文件不能超过 10 MB。');
  toast('正在上传…');
  const base64 = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
  const item = await post('upload',{bucket,name:file.name,base64});
  if (use === 'inline') insertText(`\n![${file.name.replace(/[\[\]]/g,'')}](${item.url})\n`);
  else if (use === 'cover') { $('#editor-form [name=image]').value = item.name; dirty(); }
  else { await reload(); render(); }
  toast(use === 'cover' ? '封面已上传，记得保存内容。' : '上传完成。');
}
function showDialog(html) { $('#modal-content').innerHTML = html; $('#modal').showModal(); }
function updateJob() {
  if (!$('#job-status') || !state.job) return;
  const job = state.job;
  $('#job-status').innerHTML = `${job.state === 'running' ? '<span class="spinner"></span>' : icon(job.state === 'success' ? 'check' : 'clock')}${esc(job.stage)}`;
  $('#job-log').textContent = job.logs.join('').replace(/\x1b\[[0-9;]*m/g,'');
  $('#job-log').scrollTop = $('#job-log').scrollHeight;
  $('#job-error').innerHTML = job.error ? `<div class="notice error"><strong>未完成</strong><div class="error-detail">${esc(job.error)}</div></div>` : job.state === 'success' && !job.checkOnly ? '<div class="notice">已推送 GitHub。线上是否部署成功，请打开「部署记录」查看。</div>' : '';
  $$('[data-action="confirm-publish"], [data-action="check-build"]').forEach(el => el.disabled = job.state === 'running');
}
async function pollJob() {
  clearTimeout(pollTimer);
  try {
    state.job = await api('job'); updateJob();
    if (state.job?.state === 'running') pollTimer = setTimeout(pollJob,900);
    else if (state.job) { state.git = await api('git'); toast(state.job.state === 'success' ? state.job.checkOnly ? '构建检查通过。' : '已推送到 GitHub，请查看部署记录。' : '操作未完成，请查看发布日志。',state.job.state === 'error'); }
  } catch (error) { toast('无法读取发布状态：'+error.message,true); pollTimer = setTimeout(pollJob,3000); }
}
async function startJob(checkOnly) {
  const message = $('[name=commit-message]')?.value || '更新网站内容';
  state.job = await post('publish',{message,snapshot:state.git.snapshot,checkOnly}); updateJob(); pollJob();
}
const actions = {
  import: importDialog, 'do-import': completeImport,
  navigate: el => go(el.dataset.page), new: el => openEditor(el.dataset.collection), edit: el => openEditor(el.dataset.collection,el.dataset.path), back: () => go(state.editor.collection),
  'remove-row': el => { el.closest('.repeater-row, .timeline-row').remove(); dirty(); },
  'add-skill': () => { $('#skill-rows').insertAdjacentHTML('beforeend',skillRows([{group:'',items:[]}])); dirty(); },
  'add-timeline': () => { $('#timeline-rows').insertAdjacentHTML('beforeend',timelineRows([{time:'',title:'',desc:''}])); dirty(); },
  'add-nav': () => { $('#nav-rows').insertAdjacentHTML('beforeend',navRow({label:'',href:'/'},Date.now())); dirty(); },
  delete: el => { const p = state.content[el.dataset.collection].find(p => p.path === el.dataset.path); showDialog(`<h2>删除这${contentNames[p.collection] === '文章' ? '篇文章' : '项内容'}？</h2><p>「${esc(p.data.title)}」将从本机内容列表移除。发布后网站也会移除这项内容，原文件会保存在本机的 .admin-backups 目录。</p><div class="dialog-actions">${button('取消','close-dialog','','ghost')}${button('确认删除','do-delete','trash','danger',`data-collection="${p.collection}" data-path="${esc(p.path)}" data-version="${p.version}"`)}</div>`); },
  'do-delete': async el => { await api('content',{method:'DELETE',body:JSON.stringify({collection:el.dataset.collection,path:el.dataset.path,version:el.dataset.version})}); $('#modal').close(); await reload(); render(); toast('已删除，原文件已保留本地备份。'); },
  'close-dialog': () => $('#modal').close(),
  'editor-tab': async el => { const preview = el.dataset.tab === 'preview'; state.previewing = preview; $('#markdown-body').hidden = preview; $('#markdown-preview').hidden = !preview; $$('.editor-tools .tab').forEach(t => t.classList.toggle('active',t === el)); if (preview) await renderMarkdown(); },
  insert: el => insertText(el.dataset.snippet === 'code' ? '\n```c\n// 在这里写代码\n```\n' : `\n${el.dataset.text}\n`),
  'editor-upload': () => upload('blog-assets','inline'), 'cover-upload': () => upload(state.editor.collection === 'projects' ? 'projects' : 'certs','cover'),
  'pick-cover': () => { const bucket = state.editor.collection === 'projects' ? 'projects' : 'certs', items = state.media.filter(m => m.bucket === bucket); showDialog(`<h2>选择封面图片</h2><p>来自素材库的${bucket === 'projects' ? '项目配图' : '证书图片'}</p><div class="stack">${items.length ? items.map(m => button(esc(m.name),'use-cover','image','ghost',`data-name="${esc(m.name)}"`)).join('') : '<p>还没有图片，请先上传封面。</p>'}</div><div class="dialog-actions">${button('关闭','close-dialog','','ghost')}</div>`); },
  'use-cover': el => { $('#editor-form [name=image]').value = el.dataset.name; dirty(); $('#modal').close(); },
  'media-upload': () => upload($('#upload-bucket').value),
  'copy-media': async el => { const text = el.dataset.bucket === 'blog-assets' ? `![${el.dataset.name}](${el.dataset.url})` : el.dataset.bucket === 'resumes' ? `resumes/${el.dataset.name}` : el.dataset.name; await navigator.clipboard.writeText(text); toast('已复制。'); },
  'refresh-git': async () => { state.git = await api('git'); render(); toast('发布清单已刷新。'); },
  'check-build': () => startJob(true),
  'confirm-publish': async () => { state.git = await api('git'); const git = state.git; showDialog(`<h2>确认发布到 GitHub</h2><p>将构建网站，并提交下方 ${git.changes.length} 个文件的修改，随后推送本地提交到 <strong>${esc(repoName())} / main</strong>。草稿源文件也会进入 GitHub 仓库。</p>${git.changes.length ? `<div class="dialog-changes">${changeList(git.changes)}</div>` : '<div class="notice">没有文件改动，本次将构建检查并重试推送本地提交。</div>'}<div class="dialog-actions">${button('再检查一下','close-dialog','','ghost')}${button('确认并发布','do-publish','upload','primary')}</div>`); },
  'do-publish': async () => { $('#modal').close(); await startJob(false); },
};
document.addEventListener('click',async event => {
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return;
  const action = actions[el.dataset.action]; if (!action) return;
  el.disabled = true;
  try { await action(el); } catch (error) { toast(error.message,true); } finally { if (el.isConnected) { el.disabled = false; if (state.page === 'publish') updateJob(); } }
});
document.addEventListener('submit',async event => {
  if (!['settings-form','editor-form'].includes(event.target.id)) return;
  event.preventDefault(); const form = event.target, submit = $('[type=submit]',form); submit.disabled = true;
  // 编辑中的内容不允许在保存请求途中继续变化。
  const controls = $$('input,textarea,select,button',form), disabled = controls.map(el => el.disabled);
  try {
    // 序列化先于禁用控件，异步保存函数会在首次 await 前读取完表单。
    const operation = form.id === 'editor-form' ? saveEditor(form) : saveSettings(form);
    controls.forEach(el => el.disabled = true); await operation;
  } catch (error) { toast(error.message,true); }
  finally { controls.forEach((el,i) => { if (el.isConnected) el.disabled = disabled[i]; }); if (submit.isConnected) submit.disabled = false; }
});
document.addEventListener('input',event => {
  if (event.target.closest('#settings-form, #editor-form')) dirty();
  if (event.target.id === 'content-search') { state.filter = event.target.value; $('#list-results').innerHTML = listItems(state.page); }
  if (event.target.id === 'markdown-body') { $('#word-count').textContent = `${event.target.value.replace(/\s/g,'').length} 字`; if (state.previewing) { clearTimeout(previewTimer); previewTimer = setTimeout(() => renderMarkdown().catch(e => toast(e.message,true)),400); } }
});
document.addEventListener('change',event => {
  if (event.target.id === 'import-markdown') prepareSelectedArticle(event.target.files[0]);
  if (['import-image-files','import-image-folder'].includes(event.target.id)) collectImportImages(event.target.files);
  if (event.target.id === 'draft-filter') { state.category = event.target.value; $('#list-results').innerHTML = listItems(state.page); }
  if (event.target.id === 'media-filter') { state.mediaBucket = event.target.value; render(); }
  if (event.target.closest('#settings-form, #editor-form')) dirty();
});
$('#preview-site').addEventListener('click',async () => {
  const el = $('#preview-site'); el.disabled = true;
  const win = window.open('about:blank','_blank'); if (win) win.opener = null;
  try { toast('正在启动网站预览…'); const result = await post('preview-site',{}); toast('网站预览已启动，已保存的修改会自动更新。'); if (win) win.location.href = result.url; else showDialog(`<h2>网站预览已启动</h2><p>浏览器未自动打开新标签页，请点击下方按钮查看网站。已保存的修改会自动更新到预览中。</p><div class="dialog-actions">${button('关闭','close-dialog','','ghost')}<a class="button primary" href="${esc(result.url)}" target="_blank" rel="noopener">${icon('external')}打开网站预览</a></div>`); }
  catch (error) { win?.close(); toast(error.message,true); } finally { el.disabled = false; }
});
document.addEventListener('keydown',event => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { const form = $('#editor-form, #settings-form'); if (form) { event.preventDefault(); form.requestSubmit(); } } });
try { await reload(); state.job = await api('job'); navigate(location.hash.slice(1) || 'dashboard'); if (state.job?.state === 'running') pollJob(); }
catch (error) { $('#main').innerHTML = `<div class="notice error"><h2>后台暂时无法读取内容</h2><p>${esc(error.message)}</p><p>请检查启动终端中的错误信息，处理后刷新页面。</p></div>`; }
