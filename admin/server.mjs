import http from 'node:http';
import net from 'node:net';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkObsidian } from '../src/plugins/remark-obsidian.mjs';
import { AdminError, Store, Publisher, safePath, relativeName } from './lib.mjs';
import { prepareImport, importArticle } from './import.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.pdf': 'application/pdf' };
const fail = (message, status = 400) => { throw new AdminError(message, status); };
async function jsonBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) fail('只接受 JSON 请求。', 415);
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 15 * 1024 * 1024) fail('请求超过 15 MB。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('JSON 格式错误。'); }
}
export function createAdmin({ root = path.resolve(directory, '..'), publisher = new Publisher(root) } = {}) {
  const store = new Store(root);
  const token = randomBytes(32).toString('hex');
  const previews = new Map();
  let busy = false, previewProcess, previewUrl, previewStarting, markdown;
  const locked = async action => {
    if (busy || publisher.job?.state === 'running') fail('正在保存、检查或发布，请稍候再试。', 409);
    busy = true; try { return await action(); } finally { busy = false; }
  };
  async function startPreview() {
    if (previewProcess && previewUrl) return previewUrl;
    if (previewStarting) return previewStarting;
    previewStarting = (async () => {
      const reserve = net.createServer();
      await new Promise((resolve, reject) => { reserve.once('error', reject); reserve.listen(0, '127.0.0.1', resolve); });
      const port = reserve.address().port;
      await new Promise(resolve => reserve.close(resolve));
      const url = `http://127.0.0.1:${port}`;
      const child = spawn(process.execPath, [path.join(root, 'node_modules/astro/astro.js'), 'dev', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      previewProcess = child;
      let output = '', ended = false;
      for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-8000); });
      child.on('error', error => { ended = true; output += error.message; });
      child.on('exit', () => { ended = true; previewProcess = null; previewUrl = null; });
      for (let i = 0; i < 300; i++) {
        if (ended) fail('网站预览启动失败：' + output);
        // Astro 输出 Local 地址时已监听端口，页面首次编译交给浏览器等待，避免短请求反复中断编译。
        if (/Local/.test(output)) { previewUrl = url; return url; }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      child.kill(); fail('网站预览启动超时：' + output);
    })();
    try { return await previewStarting; } finally { previewStarting = null; }
  }
  const server = http.createServer(async (request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const json = (data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self' about:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      if (request.headers.host !== new URL(origin).host) fail('请使用启动终端显示的 127.0.0.1 地址。', 403);
      const url = new URL(request.url, origin);
      const route = url.pathname;
      // 不带同源权限的预览沙箱会以跨站模式加载图片；仅公开素材允许这种只读请求。
      const publicAsset = ['GET', 'HEAD'].includes(request.method) && !route.startsWith('/api/') && /\.(png|jpe?g|gif|webp|avif|pdf|svg)$/i.test(route);
      if (!publicAsset && request.headers.origin && request.headers.origin !== origin) fail('拒绝其他网站发起的请求。', 403);
      if (!publicAsset && request.headers['sec-fetch-site'] === 'cross-site') fail('拒绝跨站请求。', 403);
      if (route.startsWith('/markdown-preview/') && request.method === 'GET') {
        const html = previews.get(route);
        if (!html) fail('预览已过期，请重新点击预览。', 404);
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('X-Frame-Options', 'SAMEORIGIN');
        response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' http: https: data:; style-src 'unsafe-inline'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'");
        response.end(html); return;
      }
      if (route.startsWith('/api/')) {
        if (request.method !== 'GET' && request.headers['x-admin-token'] !== token) fail('后台会话已失效，请刷新页面。', 403);
        if (route === '/api/health' && request.method === 'GET') return json({ app: 'wind-studio', status: 'ok', root: path.resolve(root), pid: process.pid });
        if (route === '/api/bootstrap' && request.method === 'GET') return json({ token, settings: await store.readSettings(), content: Object.fromEntries(await Promise.all(['blog', 'projects', 'awards'].map(async c => [c, await store.listContent(c)]))), git: await publisher.status(), media: await store.media() });
        if (route === '/api/settings' && request.method === 'PUT') return json(await locked(async () => { const body = await jsonBody(request); return { version: await store.saveSettings(body.data, body.version) }; }));
        if (route === '/api/content' && request.method === 'GET') return json(await store.readContent(url.searchParams.get('collection'), url.searchParams.get('path')));
        if (route === '/api/content' && request.method === 'POST') return json(await locked(async () => ({ version: await store.writeContent(await jsonBody(request)) })));
        if (route === '/api/content' && request.method === 'DELETE') return json(await locked(async () => { const body = await jsonBody(request); await store.deleteContent(body.collection, body.path, body.version); return { ok: true }; }));
        if (route === '/api/upload' && request.method === 'POST') return json(await locked(async () => store.upload(await jsonBody(request))));
        if (route === '/api/import/prepare' && request.method === 'POST') {
          const prepared = await prepareImport(store, await jsonBody(request));
          return json({ ...prepared, references:[...new Set(prepared.references.map(ref => ref.url))] });
        }
        if (route === '/api/import' && request.method === 'POST') return json(await locked(async () => importArticle(store, await jsonBody(request))));
        if (route === '/api/render' && request.method === 'POST') {
          const { body } = await jsonBody(request);
          if (typeof body !== 'string' || body.length > 2_000_000) fail('正文太长或格式错误。');
          markdown ??= createMarkdownProcessor({ remarkPlugins: [remarkObsidian], shikiConfig: { theme: 'github-dark', wrap: true } });
          const rendered = await (await markdown).render(body);
          const previewUrl = `/markdown-preview/${randomUUID()}`;
          previews.set(previewUrl, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:14px/1.9 system-ui,sans-serif;background:#141a16;color:#c8d8cc;margin:24px;overflow-wrap:anywhere}h1,h2,h3{color:#e1ede4;line-height:1.5}a{color:#b6e6b9}img{max-width:100%;border-radius:6px}pre{padding:16px;border-radius:7px;overflow:auto}code{font-family:Consolas,monospace;font-size:12px}blockquote{border-left:3px solid #91b399;padding-left:16px;color:#8ea896}table{border-collapse:collapse}td,th{border:1px solid #3b4b40;padding:7px}hr{border:0;border-top:1px solid #3b4b40}</style></head><body>${rendered.code}</body></html>`);
          if (previews.size > 10) previews.delete(previews.keys().next().value);
          return json({ html: rendered.code, previewUrl });
        }
        if (route === '/api/git' && request.method === 'GET') return json(await publisher.status());
        if (route === '/api/publish' && request.method === 'POST') {
          const body = await jsonBody(request);
          return json(await locked(() => publisher.start(body)), 202);
        }
        if (route === '/api/job' && request.method === 'GET') return json(publisher.job);
        if (route === '/api/preview-site' && request.method === 'POST') return json({ url: await startPreview() });
        fail('接口不存在。', 404);
      }
      if (!['GET', 'HEAD'].includes(request.method)) fail('不支持的请求方法。', 405);
      let target;
      if (route === '/') target = path.join(directory, 'ui/index.html');
      else if (['/app.js', '/styles.css'].includes(route)) target = path.join(directory, 'ui', route.slice(1));
      else {
        const name = decodeURIComponent(route.slice(1)); relativeName(name);
        target = await safePath(root, `public/${name}`);
        if (!/\.(png|jpe?g|gif|webp|avif|pdf|svg)$/i.test(name)) fail('文件不存在。', 404);
      }
      const bytes = await fs.readFile(target);
      response.setHeader('Content-Type', mime[path.extname(target).toLowerCase()] || 'application/octet-stream');
      if (request.method === 'HEAD') response.end(); else response.end(bytes);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      json({ error: error.code === 'ENOENT' ? '文件不存在。' : error.message }, status);
    }
  });
  server.on('close', () => previewProcess?.kill());
  return { server, store, publisher };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { server } = createAdmin();
  const port = Number(process.env.ADMIN_PORT || 4322);
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已占用。如后台已启动，请打开 http://127.0.0.1:${port}；也可设置 ADMIN_PORT 更换端口。` : error); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    console.log(`\n  WIND / STUDIO · 网站内容管理\n\n  后台地址：${url}\n  仅在本机运行。按 Ctrl+C 关闭。\n`);
    if (process.argv.includes('--open') && process.platform === 'win32') spawn('explorer.exe', [url], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
}
