import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAdmin } from '../launch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

test('后台未运行时自动启动；重复打开复用同一进程，页面可访问', async t => {
  const reservation = http.createServer();
  const port = await listen(reservation);
  await close(reservation);
  const first = await ensureAdmin({ root, port });
  t.after(() => { try { process.kill(first.pid); } catch {} });
  assert.equal(first.started, true);
  const second = await ensureAdmin({ root, port });
  assert.equal(second.started, false);
  assert.equal(first.pid, second.pid);
  const page = await fetch(first.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /STUDIO|Studio/);
});

test('端口被其他程序或另一份项目占用时保留现有服务并提示', async t => {
  let body = { app: 'another-app' };
  const server = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(body));
  });
  const port = await listen(server);
  t.after(() => close(server));
  await assert.rejects(ensureAdmin({ root, port }), /端口已被/);
  body = { app: 'wind-studio', status: 'ok', root: path.join(root, 'another-project'), pid: process.pid };
  await assert.rejects(ensureAdmin({ root, port }), /端口已被/);
  assert.equal(server.listening, true);
});

test('错误端口设置在启动前给出提示', async () => {
  for (const port of [0, -1, 65536, NaN, 4322.5]) {
    await assert.rejects(ensureAdmin({ root, port }), /ADMIN_PORT/);
  }
});
