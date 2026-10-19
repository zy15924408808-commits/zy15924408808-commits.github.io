import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';

export class AdminError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const hash = value => createHash('sha256').update(value).digest('hex');
const collections = ['blog', 'projects', 'awards'];
const buckets = ['blog-assets', 'projects', 'certs', 'resumes'];
export function relativeName(value, extension) {
  if (typeof value !== 'string' || value.length > 220 || value.includes('\\')) throw new AdminError('文件路径不合法。');
  const parts = value.split('/');
  if (parts.some(p => !p || p.startsWith('.') || /[<>:"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new AdminError('文件名包含不支持的字符或目录。');
  if (extension && !value.endsWith(extension)) throw new AdminError(`文件必须以 ${extension} 结尾。`);
  return value;
}
export async function safePath(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new AdminError('禁止访问项目以外的文件。', 403);
  let current = path.resolve(root);
  for (const part of path.relative(root, target).split(path.sep)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new AdminError('后台不读写符号链接。', 403);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}
export async function walk(root, base = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, base), { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const name = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await walk(root, name));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
function requiredString(value, label, max = 20000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AdminError(`${label}不能为空，且长度不能超过 ${max}。`);
}
function optionalString(value, label) { if (value !== undefined && typeof value !== 'string') throw new AdminError(`${label}必须是文字。`); }
function url(value, label) {
  if (!value) return;
  try { if (!['http:', 'https:'].includes(new URL(value).protocol)) throw new Error(); }
  catch { throw new AdminError(`${label}请填写完整的 http 或 https 地址。`); }
}
function date(value, required = false) {
  if (!value && !required) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new AdminError('请填写有效日期（YYYY-MM-DD）。');
}
export function validateContent(collection, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AdminError('内容属性格式错误。');
  requiredString(data.title, '标题', 300);
  for (const key of ['description', 'category', 'image', 'repo', 'link', 'issuer', 'level']) optionalString(data[key], key);
  if (collection === 'projects') requiredString(data.description, '项目简介');
  if (collection === 'blog') { date(data.date, true); if (data.draft !== undefined && typeof data.draft !== 'boolean') throw new AdminError('草稿状态格式错误。'); }
  if (collection === 'awards') date(data.date);
  for (const key of ['tags', 'stack']) if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].some(item => typeof item !== 'string'))) throw new AdminError(`${key} 必须是文字列表。`);
  if (data.order !== undefined && (typeof data.order !== 'number' || !Number.isFinite(data.order))) throw new AdminError('排序必须是数字。');
  url(data.repo, '仓库地址'); url(data.link, '演示地址');
  if (data.image) { relativeName(data.image); if (data.image.includes('/')) throw new AdminError('封面只需填写图片文件名。'); }
}
export function validateSettings(data) {
  if (!data?.site || !data?.about || !data?.giscus || !Array.isArray(data.nav)) throw new AdminError('站点配置不完整。');
  requiredString(data.site.name, '名字', 100);
  for (const key of ['tagline', 'intro', 'email', 'resume']) if (typeof data.site[key] !== 'string') throw new AdminError(`${key} 必须是文字。`);
  if (data.site.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.site.email)) throw new AdminError('邮箱格式不正确。');
  url(data.site.social?.github, 'GitHub'); url(data.site.social?.bilibili, 'Bilibili');
  if (!data.site.social || ['github', 'bilibili'].some(key => typeof data.site.social[key] !== 'string')) throw new AdminError('社交链接格式错误。');
  if (data.site.resume) { relativeName(data.site.resume); if (!data.site.resume.toLowerCase().endsWith('.pdf')) throw new AdminError('简历必须是 PDF 文件。'); }
  if (!Array.isArray(data.about.paragraphs) || data.about.paragraphs.some(p => typeof p !== 'string')) throw new AdminError('个人简介应为文字段落。');
  if (!Array.isArray(data.about.skills) || data.about.skills.some(s => typeof s.group !== 'string' || !Array.isArray(s.items) || s.items.some(i => typeof i !== 'string'))) throw new AdminError('技能栈格式错误。');
  if (!Array.isArray(data.about.timeline) || data.about.timeline.some(t => ['time', 'title', 'desc'].some(k => typeof t[k] !== 'string'))) throw new AdminError('经历格式错误。');
  for (const n of data.nav) { requiredString(n.label, '导航名称', 100); if (typeof n.href !== 'string' || !/^\/(?!\/)/.test(n.href) || /[\s\\]/.test(n.href)) throw new AdminError('导航链接应为 /about 这样的站内路径。'); }
  for (const key of ['repo', 'repoId', 'category', 'categoryId']) if (typeof data.giscus[key] !== 'string') throw new AdminError('评论配置必须是文字。');
}
export function parseContent(raw) {
  const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new AdminError('文章缺少 Markdown 顶部的属性区。');
  const data = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
  return { data, body: raw.replace(/^\uFEFF/, '').slice(match[0].length) };
}
export function slug(name) {
  return path.posix.basename(name, '.md').normalize('NFKC').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
}
export class Store {
  constructor(root) { this.root = root; }
  contentPath(collection, name) {
    if (!collections.includes(collection)) throw new AdminError('未知的内容类型。');
    return safePath(this.root, `src/content/${collection}/${relativeName(name, '.md')}`);
  }
  async readSettings() {
    const raw = await fs.readFile(await safePath(this.root, 'src/data/site.json'), 'utf8');
    return { data: JSON.parse(raw), version: hash(raw) };
  }
  async save(relative, value, version) {
    const target = await safePath(this.root, relative);
    const old = await fs.readFile(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if ((old ? hash(old) : null) !== version) throw new AdminError('文件已在其他窗口或编辑器中改动。请先复制未保存的内容，重新加载后再保存。', 409);
    if (old) await this.backup(relative, old);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temp, value, { flag: 'wx' }); await fs.rename(temp, target); }
    finally { await fs.rm(temp, { force: true }); }
    return hash(value);
  }
  async backup(relative, bytes) {
    const backup = await safePath(this.root, `.admin-backups/${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}/${relative}`);
    await fs.mkdir(path.dirname(backup), { recursive: true }); await fs.writeFile(backup, bytes);
  }
  async saveSettings(data, version) { validateSettings(data); return this.save('src/data/site.json', JSON.stringify(data, null, 2) + '\n', version); }
  async readContent(collection, name) {
    const raw = await fs.readFile(await this.contentPath(collection, name), 'utf8');
    return { collection, path: name, ...parseContent(raw), version: hash(raw) };
  }
  async listContent(collection) {
    if (!collections.includes(collection)) throw new AdminError('未知的内容类型。');
    const names = (await walk(path.join(this.root, 'src/content', collection))).filter(n => n.endsWith('.md'));
    return Promise.all(names.map(async name => {
      try { const entry = await this.readContent(collection, name); const { body, ...rest } = entry; return { ...rest, words: body.replace(/\s/g, '').length }; }
      catch (error) { return { path: name, collection, data: { title: name }, error: error.message }; }
    }));
  }
  async writeContent({ collection, path: name, data, body, version }) {
    await this.contentPath(collection, name);
    validateContent(collection, data);
    if (typeof body !== 'string' || body.length > 2_000_000) throw new AdminError('正文格式错误或超过 2 MB。');
    const nextSlug = slug(name);
    if (!nextSlug) throw new AdminError('文件名需要包含文字或数字。');
    const all = await this.listContent(collection);
    if (all.some(entry => entry.path !== name && slug(entry.path) === nextSlug)) throw new AdminError('这个文件名生成的网址已被其他内容使用，请换一个文件名。', 409);
    const raw = `---\n${yaml.dump(data, { schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true })}---\n${body}`;
    return this.save(`src/content/${collection}/${name}`, raw, version);
  }
  async deleteContent(collection, name, version) {
    const target = await this.contentPath(collection, name);
    const raw = await fs.readFile(target);
    if (hash(raw) !== version) throw new AdminError('内容已修改，请刷新后再删除。', 409);
    await this.backup(`src/content/${collection}/${name}`, raw); await fs.unlink(target);
  }
  async media() {
    const result = [];
    for (const bucket of buckets) {
      const directory = await safePath(this.root, `public/${bucket}`);
      for (const name of await walk(directory)) if (/\.(png|jpe?g|gif|webp|avif|pdf)$/i.test(name)) {
        const stat = await fs.stat(await safePath(this.root, `public/${bucket}/${name}`));
        result.push({ bucket, name, url: `/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`, size: stat.size });
      }
    }
    return result;
  }
  async upload({ bucket, name, base64 }) {
    const bytes = decodeUpload({ bucket, name, base64 });
    const ext = path.extname(name).toLowerCase();
    const filename = `${path.basename(name, path.extname(name))}-${randomUUID().slice(0, 8)}${ext}`;
    await this.save(`public/${bucket}/${filename}`, bytes, null);
    return { name: filename, url: `/${bucket}/${encodeURIComponent(filename)}`, relative: `${bucket}/${filename}` };
  }
}
export function decodeUpload({ bucket, name, base64 }) {
  if (!buckets.includes(bucket)) throw new AdminError('未知的素材目录。');
  relativeName(name);
  if (name.includes('/')) throw new AdminError('上传时只填写文件名。');
  const ext = path.extname(name).toLowerCase();
  if (!(bucket === 'resumes' ? ['.pdf'] : ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']).includes(ext)) throw new AdminError('请选择 PNG、JPG、GIF、WebP、AVIF 图片；简历请选择 PDF。');
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new AdminError('上传数据格式错误。');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new AdminError('文件必须在 10 MB 以内。');
  const valid = ext === '.pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' :
    ext === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    ['.jpg', '.jpeg'].includes(ext) ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    ext === '.gif' ? /^GIF8[79]a/.test(bytes.subarray(0, 6).toString()) :
    ext === '.webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' :
    bytes.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(bytes.subarray(8, 40).toString());
  if (!valid) throw new AdminError('文件内容与扩展名不符。');
  return bytes;
}
export function command(root, executable, args, onOutput = () => {}, env = {}, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, shell: false, windowsHide: true, env: { ...process.env, ...env } });
    let output = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    for (const stream of [child.stdout, child.stderr]) { stream.setEncoding('utf8'); stream.on('data', text => { output += text; onOutput(text); }); }
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (code === 0 && !timedOut) resolve(output); else reject(new AdminError(timedOut ? '操作超时，请检查网络或 Git 登录状态后重试。' : output.trim() || `${executable} 执行失败（${code}）`, 400)); });
  });
}
export class Publisher {
  constructor(root, runner = command) { this.root = root; this.run = runner; this.job = null; }
  git(args, log) { return this.run(this.root, 'git', ['-c', 'core.quotepath=false', ...args], log, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }); }
  async status() {
    const branch = (await this.git(['branch', '--show-current'])).trim();
    const remote = (await this.git(['remote', 'get-url', 'origin'])).trim();
    const head = (await this.git(['rev-parse', 'HEAD'])).trim();
    const raw = await this.git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const parts = raw.split('\0').filter(Boolean); const changes = [];
    for (let i = 0; i < parts.length; i++) {
      const code = parts[i].slice(0, 2), name = parts[i].slice(3);
      changes.push({ code, path: name });
      if (/[RC]/.test(code)) changes.push({ code: ' D', path: parts[++i] });
    }
    let ahead = 0, behind = 0;
    try { const counts = (await this.git(['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`])).trim().split(/\s+/).map(Number); [ahead, behind] = counts; } catch {}
    const hashes = [];
    for (const change of changes) {
      const target = await safePath(this.root, change.path);
      const bytes = await fs.readFile(target).catch(error => { if (error.code === 'ENOENT') return Buffer.from('deleted'); throw error; });
      hashes.push([change.path, hash(bytes)]);
    }
    return { branch, remote, head, changes, ahead, behind, snapshot: hash(JSON.stringify({ head, remote, branch, raw, hashes })), actionsUrl: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(remote) ? remote.replace(/\.git$/, '') + '/actions' : '' };
  }
  start({ message = '更新网站内容', snapshot, checkOnly = false }) {
    if (this.job?.state === 'running') throw new AdminError('已有检查或发布正在进行，请稍候。', 409);
    requiredString(message, '提交说明', 300);
    const job = this.job = { id: randomUUID(), state: 'running', checkOnly, stage: '准备中', logs: [], startedAt: new Date().toISOString() };
    const log = text => { job.logs.push(text); if (job.logs.join('').length > 160000) job.logs.shift(); };
    this.execute(job, { message, snapshot, checkOnly }, log).then(() => { job.state = 'success'; job.stage = checkOnly ? '检查通过' : '已推送到 GitHub'; }).catch(error => { job.state = 'error'; job.error = error.message; job.stage = '操作未完成'; log('\n' + error.message + '\n'); });
    return job;
  }
  async execute(job, { message, snapshot, checkOnly }, log) {
    const before = await this.status();
    if (!checkOnly && before.snapshot !== snapshot) throw new AdminError('发布清单已发生变化，请刷新清单后再次确认。', 409);
    if (!checkOnly && before.branch !== 'main') throw new AdminError('当前部署工作流只监听 main 分支，请先切换到 main 后发布。');
    if (!checkOnly && !/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+(?:\.git)?$/.test(before.remote)) throw new AdminError('origin 不是支持的 GitHub 仓库地址。');
    job.stage = '构建检查'; log('开始构建，检查文章、项目和页面…\n');
    await this.run(this.root, process.execPath, [path.join(this.root, 'node_modules/astro/astro.js'), 'build'], log);
    if (checkOnly) return;
    const after = await this.status();
    if (before.snapshot !== after.snapshot) throw new AdminError('构建过程中有文件发生变化，已停止发布。请刷新清单后重试。');
    const paths = [...new Set(after.changes.map(c => c.path))];
    if (paths.length) {
      job.stage = '提交更改'; log('\n构建通过，正在创建本地提交…\n');
      // 仅提交清单中审核过的文件；参数数组不会执行 shell 内容。
      try {
        await this.git(['add', '--', ...paths], log);
        await this.git(['commit', '--only', '-m', message, '--', ...paths], log);
      } catch (error) {
        if (/index\.lock.*Permission denied/i.test(error.message)) throw new AdminError('文章已保存在本机，但后台无权写入 Git 目录，尚未推送。请关闭当前后台，在文件资源管理器中双击「启动网站后台.cmd」重新启动，再刷新页面并重试发布。不要从 Codex 沙箱启动发布后台，也无需删除锁文件。\n' + error.message);
        throw error;
      }
    } else log('\n没有新的文件修改，尝试推送已有本地提交。\n');
    job.stage = '推送 GitHub'; log('\n正在推送 origin/main（不会强制推送）…\n');
    try { await this.git(['push', 'origin', 'HEAD:refs/heads/main'], log); }
    catch (error) { throw new AdminError(`推送失败。本地提交已保留，可直接重试。请检查 GitHub 登录、网络，或远端是否有新提交。\n${error.message}`); }
    log('\n推送完成。GitHub Actions 将继续部署网站，可打开部署记录查看结果。\n');
  }
}
