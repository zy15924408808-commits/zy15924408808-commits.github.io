// 启动入口只使用 Node 内置模块，依赖问题也能给出清晰提示。
import { spawn } from 'node:child_process';
import { open, mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const samePath = (a, b) => process.platform === 'win32'
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);

async function health(url, root) {
  let response;
  try {
    response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500), redirect: 'error' });
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return null;
    throw new Error(`无法确认后台状态：${error.message}。请检查 ${url} 是否被其他程序占用。`);
  }
  let data;
  try { data = await response.json(); } catch { /* 非本后台的响应 */ }
  if (!response.ok || data?.app !== 'wind-studio' || data.status !== 'ok' || typeof data.root !== 'string' || !samePath(data.root, root)) {
    throw new Error(`端口已被其他程序或旧版后台占用：${url}。请先关闭旧后台再双击打开网站管理；不要结束不认识的程序。`);
  }
  return data;
}

export async function ensureAdmin({ root = projectRoot, port = Number(process.env.ADMIN_PORT || 4322) } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ADMIN_PORT 必须是 1 到 65535 之间的整数。');
  const url = `http://127.0.0.1:${port}`;
  const existing = await health(url, root);
  if (existing) return { url, pid: existing.pid, started: false };
  try { await access(path.join(root, 'node_modules/astro/astro.js')); }
  catch { throw new Error('尚未安装网站依赖。请在项目目录执行 npm install，然后重新打开。'); }
  const logDirectory = path.join(root, '.admin-backups');
  await mkdir(logDirectory, { recursive: true });
  const output = await open(path.join(logDirectory, 'startup-output.log'), 'a');
  const errors = await open(path.join(logDirectory, 'startup-error.log'), 'a');
  let child;
  try {
    child = spawn(process.execPath, [path.join(root, 'admin/server.mjs')], {
      cwd: root, env: { ...process.env, ADMIN_PORT: String(port) },
      detached: true, windowsHide: true, stdio: ['ignore', output.fd, errors.fd],
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
  } finally { await Promise.all([output.close(), errors.close()]); }
  for (let attempt = 0; attempt < 100; attempt++) {
    await delay(150);
    const ready = await health(url, root);
    if (ready) return { url, pid: ready.pid, started: true };
    if (child.exitCode !== null) break;
  }
  const detail = await readFile(path.join(logDirectory, 'startup-error.log'), 'utf8').catch(() => '');
  throw new Error(`后台未能启动，请查看 .admin-backups/startup-error.log。${detail ? `\n${detail.slice(-2000)}` : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await ensureAdmin();
    console.log(`${result.started ? '后台已自动启动' : '后台已在运行'}：${result.url}\n关闭此窗口或浏览器不会停止后台，重启电脑后再次双击即可。`);
    if (process.platform === 'win32' && !process.argv.includes('--no-open')) {
      const browser = spawn('explorer.exe', [result.url], { windowsHide: true, stdio: 'ignore', detached: true });
      browser.on('error', () => console.error(`浏览器未能自动打开，请手动访问 ${result.url}`));
      browser.unref();
    }
  } catch (error) {
    console.error(`\n打开网站管理失败：${error.message}`);
    process.exitCode = 1;
  }
}
