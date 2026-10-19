import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { Store, Publisher, command, walk, relativeName } from '../lib.mjs';
import { createAdmin } from '../server.mjs';

const example = { collection:'blog', path:'嵌入式/first.md', data:{title:'第一篇：串口调试',date:'2026-10-19',tags:['STM32'],draft:true,custom:'保留自定义属性'},body:'## 代码\n\n```c\nprintf("你好");\n```\n',version:null };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'wind-admin-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'src/data'),{recursive:true});
  await fs.copyFile(new URL('../../src/data/site.json',import.meta.url),path.join(root,'src/data/site.json'));
  return {root,store:new Store(root)};
}
test('内容保留中文、代码和未知属性；并发修改不会被覆盖；删除有备份',async t => {
  const {root,store} = await fixture(t);
  const first = await store.writeContent(example);
  const content = await store.readContent('blog',example.path);
  assert.equal(content.data.custom,'保留自定义属性'); assert.equal(content.body,example.body); assert.equal(content.version,first);
  const second = await store.writeContent({...content,data:{...content.data,title:'修改后的标题'}});
  await assert.rejects(store.writeContent({...content,body:'旧窗口保存'}),/其他窗口/);
  await assert.rejects(store.deleteContent('blog',example.path,first),/已修改/);
  await store.deleteContent('blog',example.path,second);
  assert.equal((await store.listContent('blog')).length,0);
  assert.equal((await walk(path.join(root,'.admin-backups'))).filter(n => n.endsWith('.md')).length,2);
});
test('拒绝越界路径、非法日期、重复网址、恶意链接；保存资料保留备份',async t => {
  const {root,store} = await fixture(t);
  for (const name of ['../x.md','x/../y.md','/x.md','C:/x.md','a\\x.md','CON.md','x./a.md']) assert.throws(() => relativeName(name,'.md'));
  await assert.rejects(store.writeContent({...example,data:{...example.data,date:'2026-02-30'}}),/日期/);
  await assert.rejects(store.writeContent({...example,collection:'projects',data:{title:'危险链接',description:'简介',repo:'javascript:alert(1)'}}),/http/);
  await store.writeContent(example);
  await assert.rejects(store.writeContent({...example,path:'另一分类/FIRST.md'}),/网址/);
  await assert.rejects(store.writeContent({...example,path:'!.md'}),/文字或数字/);
  const settings = await store.readSettings(); settings.data.site.name = '测试用户';
  await store.saveSettings(settings.data,settings.version);
  assert.equal((await store.readSettings()).data.site.name,'测试用户');
  await assert.rejects(store.saveSettings(settings.data,settings.version),/其他窗口/);
  assert.ok((await walk(path.join(root,'.admin-backups'))).some(n => n.endsWith('site.json')));
});
test('上传校验真实文件类型、保持同名素材不被覆盖',async t => {
  const {store} = await fixture(t);
  const png = Buffer.from('89504e470d0a1a0a00000000','hex').toString('base64');
  const one = await store.upload({bucket:'projects',name:'配图.png',base64:png});
  const two = await store.upload({bucket:'projects',name:'配图.png',base64:png});
  assert.notEqual(one.name,two.name); assert.equal((await store.media()).length,2);
  await assert.rejects(store.upload({bucket:'projects',name:'x.png',base64:Buffer.from('<script>alert(1)</script>').toString('base64')}),/不符/);
  await assert.rejects(store.upload({bucket:'projects',name:'x.svg',base64:png}),/请选择/);
  await assert.rejects(store.upload({bucket:'../../',name:'x.png',base64:png}),/未知/);
});
async function waitJob(publisher) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (publisher.job.state !== 'running') return publisher.job; await new Promise(r => setTimeout(r,20)); }
  throw new Error('job timeout');
}
function mockPublisher({buildFails=false,pushFails=false,indexDenied=false}={}) {
  const calls = [];
  const publisher = new Publisher('unused',async (_root,exe,args,log=()=>{}) => {
    calls.push([exe,...args]);
    if (exe === process.execPath) { if (buildFails) throw new Error('内容不合法，构建失败'); log('build passed\n'); }
    if (args.includes('push') && pushFails) throw new Error('网络不可用');
    if (args.includes('add') && indexDenied) throw new Error("fatal: Unable to create 'D:/site/.git/index.lock': Permission denied");
    return '';
  });
  publisher.status = async () => ({snapshot:'reviewed',branch:'main',remote:'https://github.com/owner/repo.git',changes:[{code:' M',path:'src/data/site.json'}]});
  return {publisher,calls};
}
test('构建失败或清单过期时不会提交和推送；运行时防止重复发布',async () => {
  const {publisher,calls} = mockPublisher({buildFails:true});
  publisher.start({message:'测试',snapshot:'reviewed'});
  assert.throws(() => publisher.start({message:'重复'}),/正在进行/);
  assert.equal((await waitJob(publisher)).state,'error');
  assert.equal(calls.some(c => c.includes('commit') || c.includes('push')),false);
  const second = mockPublisher(); second.publisher.start({snapshot:'stale'});
  assert.equal((await waitJob(second.publisher)).state,'error'); assert.equal(second.calls.length,0);
});
test('发布先构建再提交和推送；推送失败说明本地提交已保留；仅检查不执行 Git 写操作',async () => {
  const {publisher,calls} = mockPublisher({pushFails:true});
  publisher.start({message:'含有 shell 字符 $(echo hi) 的说明',snapshot:'reviewed'});
  const job = await waitJob(publisher); assert.equal(job.state,'error'); assert.match(job.error,/本地提交已保留/);
  assert.equal(calls[0][0],process.execPath);
  assert.ok(calls[2].includes('commit')); assert.ok(calls[3].includes('push'));
  assert.ok(calls[2].includes('含有 shell 字符 $(echo hi) 的说明'));
  assert.equal(calls.flat().includes('--force'),false);
  const second = mockPublisher(); second.publisher.start({checkOnly:true}); await waitJob(second.publisher);
  assert.equal(second.publisher.job.state,'success'); assert.equal(second.calls.length,1);
});

test('Git 目录写入被拒绝时说明正常启动方式，并停止提交和推送',async () => {
  const {publisher,calls} = mockPublisher({indexDenied:true});
  publisher.start({snapshot:'reviewed'});
  const job = await waitJob(publisher);
  assert.equal(job.state,'error'); assert.match(job.error,/启动网站后台.cmd/); assert.match(job.error,/文章已保存在本机/);
  assert.equal(calls.some(c => c.includes('commit') || c.includes('push')),false);
});
test('真实 Git 仓库能够读取中文和带空格文件；发布流程推送到隔离的本地 bare 仓库',async t => {
  const {root} = await fixture(t);
  const remote = path.join(root,'remote.git'); await command(root,'git',['init','--bare',remote]);
  await fs.writeFile(path.join(root,'.gitignore'),'remote.git/\n');
  await command(root,'git',['init','-b','main']);
  await command(root,'git',['config','user.name','Admin Test']); await command(root,'git',['config','user.email','test@example.test']);
  await command(root,'git',['add','src','.gitignore']); await command(root,'git',['commit','-m','initial']);
  await command(root,'git',['remote','add','origin',remote]); await command(root,'git',['push','-u','origin','main']);
  const name = 'src/data/中文 带空格.json'; await fs.writeFile(path.join(root,name),'test');
  await fs.appendFile(path.join(root,'src/data/site.json'),'\n');
  const publisher = new Publisher(root,async (repo,exe,args,log,env) => {
    if (exe === process.execPath) return 'simulated successful build';
    return command(repo,exe,args,log,env);
  });
  const actualStatus = publisher.status.bind(publisher), status = await actualStatus();
  assert.ok(status.changes.some(c => c.path === name));
  // 对外目标校验保持 GitHub 格式，测试实际 push 仍走本地仓库。
  publisher.status = async () => ({...await actualStatus(),remote:'https://github.com/test/repo.git'});
  publisher.start({snapshot:status.snapshot,message:'测试中文文件'});
  assert.equal((await waitJob(publisher)).state,'success',publisher.job.error);
  const local = (await command(root,'git',['rev-parse','HEAD'])).trim();
  const pushed = (await command(root,'git',['--git-dir',remote,'rev-parse','main'])).trim(); assert.equal(local,pushed);
  assert.equal((await actualStatus()).changes.length,0);
});
test('HTTP 接口要求本机 Host、同源和令牌；支持已有 Markdown 与沙箱预览数据',async t => {
  const {root,store} = await fixture(t); await store.writeContent(example);
  const publisher = {status:async()=>({branch:'main',changes:[],remote:'https://github.com/test/repo.git'}),job:null};
  const {server} = createAdmin({root,publisher}); await new Promise(r => server.listen(0,'127.0.0.1',r));
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const bootstrap = await (await fetch(base+'/api/bootstrap')).json(); assert.equal(bootstrap.content.blog.length,1);
  assert.ok(bootstrap.token);
  const badHostStatus = await new Promise((resolve,reject) => { const req = http.get(base+'/api/bootstrap',{headers:{Host:'evil.test'}},response => { response.resume(); resolve(response.statusCode); }); req.on('error',reject); });
  assert.equal(badHostStatus,403);
  assert.equal((await fetch(base+'/api/bootstrap',{headers:{Origin:'https://evil.test'}})).status,403);
  await fs.mkdir(path.join(root,'public/blog-assets'),{recursive:true});
  await fs.writeFile(path.join(root,'public/blog-assets/sample.png'),Buffer.from('89504e470d0a1a0a','hex'));
  assert.equal((await fetch(base+'/blog-assets/sample.png',{headers:{'sec-fetch-site':'cross-site',Origin:'null'}})).status,200);
  assert.equal((await fetch(base+'/api/bootstrap',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  const settings = {data:bootstrap.settings.data,version:bootstrap.settings.version};
  const request = (route,body,token) => fetch(base+'/api/'+route,{method:'PUT',headers:{'Content-Type':'application/json','X-Admin-Token':token || ''},body:JSON.stringify(body)});
  assert.equal((await request('settings',settings)).status,403);
  assert.equal((await request('settings',settings,bootstrap.token)).status,200);
  const render = await fetch(base+'/api/render',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':bootstrap.token},body:JSON.stringify({body:'## 标题\n\n![[示例.png]]\n\n```c\nprintf("hello");\n```'})});
  const preview = await render.json(); assert.equal(render.status,200); assert.match(preview.html,/<h2/); assert.match(preview.html,/blog-assets/); assert.match(preview.html,/printf/);
  const frame = await fetch(base+preview.previewUrl); assert.equal(frame.status,200); assert.match(frame.headers.get('content-security-policy'),/^sandbox;/); assert.match(await frame.text(),/<style>/);
  const html = await fetch(base); assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/); assert.match(await html.text(),/CONTENT STUDIO/);
});
