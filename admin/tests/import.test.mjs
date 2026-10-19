import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store, walk} from '../lib.mjs';
import {prepareImport, importArticle, imageReferences} from '../import.mjs';
import {createAdmin} from '../server.mjs';

const png = Buffer.from('89504e470d0a1a0a00000000','hex').toString('base64');
const article = {name:'串口笔记.md', text:'# 串口打印\n\n中文和 `printf`。\n', date:'2026-10-19', assets:[]};
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'wind-import-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  return {root,store:new Store(root)};
}

test('无属性 Markdown 自动识别标题和日期，原正文不变；重复导入另存不覆盖',async t => {
  const {store} = await fixture(t);
  const planned = await prepareImport(store,article);
  assert.equal(planned.data.title,'串口打印'); assert.equal(planned.data.date,'2026-10-19'); assert.equal(planned.body,article.text);
  assert.equal((await store.listContent('blog')).length,0);
  const one = await importArticle(store,article), two = await importArticle(store,article);
  assert.equal(one.path,'串口笔记.md'); assert.equal(two.path,'串口笔记-2.md');
  const saved = await store.readContent('blog',one.path);
  assert.equal(saved.body,article.text); assert.equal(saved.data.draft,true);
  const filenameTitle = await prepareImport(store,{...article,text:'没有一级标题'}); assert.equal(filenameTitle.data.title,'串口笔记');
});

test('导入 Obsidian YAML 保留属性，规范日期和标签；错误 YAML、日期及越界文件名会阻止导入',async t => {
  const {store} = await fixture(t);
  const source = '\uFEFF---\r\ntitle: 原标题\r\ndate: 2026-08-13T12:00:00Z\r\ntags: STM32, 串口\r\ncategory: 单片机\r\naliases: [串口笔记]\r\nslug: old-url\r\ndraft: false\r\n---\r\n# 正文\r\n';
  const planned = await prepareImport(store,{...article,text:source});
  assert.equal(planned.data.title,'原标题'); assert.equal(planned.data.date,'2026-08-13');
  assert.deepEqual(planned.data.tags,['STM32','串口']); assert.deepEqual(planned.data.aliases,['串口笔记']);
  assert.equal(planned.data.category,'单片机'); assert.equal(planned.data.draft,true); assert.equal(planned.data.slug,undefined);
  assert.equal(planned.body,'# 正文\r\n');
  for (const name of ['D:\\笔记\\article.md','../article.md','x.txt']) await assert.rejects(prepareImport(store,{...article,name}),/请选择/);
  await assert.rejects(prepareImport(store,{...article,text:'---\ntitle: [bad\n---\n'}),/YAML/);
  await assert.rejects(prepareImport(store,{...article,text:'---\ndate: 2026-02-30\n---\n'}),/日期/);
});

test('导入普通图片、Obsidian 嵌图、引用式图片与 HTML 图片；忽略远程图片和代码里的示例',async t => {
  const {store} = await fixture(t);
  const source = '# 图片\n\n![[电路.png|电路图]]\n\n![波形](<assets/a b.png> "标题")\n\n![复用][wave]\n\n[wave]: assets/a%20b.png "另一标题"\n\n<img src="assets/a b.png" alt="波形">\n\n![远程](https://example.test/image.png)\n\n`![[code.png]]`\n\n```md\n![示例](code.png)\n```\n';
  assert.equal(imageReferences(source).length,4);
  const result = await importArticle(store,{...article,text:source,assets:[{path:'配图/电路.png',base64:png},{path:'assets/a b.png',base64:png}]});
  assert.equal(result.images,2); assert.deepEqual(result.missing,[]);
  const saved = await store.readContent('blog',result.path);
  assert.match(saved.body,/!\[电路图\]\(<\/blog-assets\//);
  assert.match(saved.body,/\[wave\]: <\/blog-assets\//);
  assert.match(saved.body,/<img src="\/blog-assets\//);
  assert.match(saved.body,/https:\/\/example.test\/image.png/); assert.match(saved.body,/`!\[\[code.png\]\]`/);
  assert.match(saved.body,/```md\n!\[示例\]\(code.png\)\n```/); assert.equal((await store.media()).length,2);
});

test('缺失图片、同名歧义、伪造图片不产生文章或残留；明确允许缺图时可保存草稿',async t => {
  const {root,store} = await fixture(t);
  const source = {...article,text:'![图](x.png)\n\n![[missing.png]]'};
  await assert.rejects(importArticle(store,{...source,assets:[{path:'x.png',base64:png}]}),/尚未选择/);
  assert.deepEqual(await walk(root),[]);
  await assert.rejects(importArticle(store,{...source,allowMissing:true,assets:[{path:'a/x.png',base64:png},{path:'b/x.png',base64:png}]}),/多个同名/);
  await assert.rejects(importArticle(store,{...source,allowMissing:true,assets:[{path:'x.png',base64:Buffer.from('not image').toString('base64')}]}),/不符/);
  assert.deepEqual(await walk(root),[]);
  const result = await importArticle(store,{...source,allowMissing:true,assets:[{path:'x.png',base64:png}]});
  assert.deepEqual(result.missing,['missing.png']); assert.equal((await store.readContent('blog',result.path)).data.draft,true);
});

test('带编码井号的图片文件名可解析，优先选择目录匹配的配图',async t => {
  const {store} = await fixture(t);
  const result = await importArticle(store,{...article,text:'![波形](assets/hash%23one.png)',assets:[{path:'assets/hash#one.png',base64:png},{path:'other/hash#one.png',base64:'invalid'}]});
  assert.equal(result.images,1); assert.deepEqual(result.missing,[]);
  assert.match((await store.readContent('blog',result.path)).body,/\/blog-assets\/hash%23one-/);
});

test('写文章失败时清理本次复制的图片，已有网站素材可以直接引用',async t => {
  const {root,store} = await fixture(t);
  const original = store.writeContent;
  store.writeContent = async () => {throw new Error('模拟磁盘写入失败');};
  await assert.rejects(importArticle(store,{...article,text:'![[x.png]]',assets:[{path:'x.png',base64:png}]}),/磁盘/);
  assert.equal((await store.media()).length,0);
  store.writeContent = original;
  await fs.writeFile(path.join(root,'public/blog-assets/existing.png'),Buffer.from(png,'base64'));
  const result = await importArticle(store,{...article,text:'![图](/blog-assets/existing.png)'});
  assert.equal(result.images,0); assert.deepEqual(result.missing,[]);
});

test('导入 HTTP 接口验证会话，先预览不写入，再保存正文到临时网站',async t => {
  const {store,root} = await fixture(t);
  await fs.mkdir(path.join(root,'src/data'),{recursive:true});
  await fs.copyFile(new URL('../../src/data/site.json',import.meta.url),path.join(root,'src/data/site.json'));
  const publisher = {status:async()=>({branch:'main',changes:[],remote:'https://github.com/test/repo.git'}),job:null};
  const {server} = createAdmin({root,publisher}); await new Promise(r => server.listen(0,'127.0.0.1',r));
  t.after(async () => {server.closeAllConnections(); await new Promise(r => server.close(r));});
  const base = `http://127.0.0.1:${server.address().port}`;
  const {token} = await (await fetch(base+'/api/bootstrap')).json();
  const send = (route,body,auth=token) => fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':auth},body:JSON.stringify(body)});
  assert.equal((await send('import',article,'')).status,403);
  const prepared = await send('import/prepare',article); assert.equal(prepared.status,200); assert.equal((await prepared.json()).data.title,'串口打印');
  assert.equal((await store.listContent('blog')).length,0);
  const imported = await send('import',article); assert.equal(imported.status,200);
  assert.equal((await store.readContent('blog',(await imported.json()).path)).body,article.text);
  const project = await send('import',{...article,collection:'projects',name:'项目.md'});
  assert.equal(project.status,200);
  const result = await project.json(); assert.equal(result.collection,'projects');
  assert.equal((await store.readContent('projects',result.path)).data.title,'串口打印');
});

test('项目 Markdown 生成简介并保留技术栈和链接，同名另存不覆盖',async t => {
  const {store} = await fixture(t);
  const source = {...article,collection:'projects',name:'README.md',text:'---\nstack: STM32, FreeRTOS\nrepo: https://github.com/test/project\nlink: https://example.test\norder: 3\n---\n# 气象时钟\n\n采集温湿度并显示在屏幕上。\n'};
  const prepared = await prepareImport(store,source);
  assert.equal(prepared.data.description,'采集温湿度并显示在屏幕上。');
  assert.deepEqual(prepared.data.stack,['STM32','FreeRTOS']); assert.equal(prepared.data.draft,undefined);
  const first = await importArticle(store,source), second = await importArticle(store,source);
  assert.equal(first.path,'readme.md'); assert.equal(second.path,'readme-2.md');
  const saved = await store.readContent('projects',first.path);
  assert.equal(saved.data.repo,'https://github.com/test/project'); assert.equal(saved.data.order,3);
  assert.equal((await store.listContent('blog')).length,0);
  await assert.rejects(prepareImport(store,{...source,text:'---\nrepo: javascript:alert(1)\n---\n# 项目'}),/http/);
  await assert.rejects(prepareImport(store,{...source,collection:'awards'}),/只支持/);
});

test('项目正文和封面共用图片只复制一次，已有封面保留、缺失封面可稍后补充',async t => {
  const {store} = await fixture(t);
  const source = {...article,collection:'projects',text:'---\nimage: assets/cover.png\ndescription: 项目简介\n---\n# 项目\n\n![[assets/cover.png]]\n',assets:[{path:'assets/cover.png',base64:png}]};
  const result = await importArticle(store,source), saved = await store.readContent('projects',result.path);
  assert.equal(result.images,1); assert.match(saved.data.image,/^cover-.*\.png$/); assert.match(saved.body,/\/projects\/cover-/);
  assert.equal((await store.media())[0].bucket,'projects');
  const existing = await importArticle(store,{...source,text:`---\nimage: ${saved.data.image}\n---\n# 已有封面\n`,assets:[]});
  assert.equal(existing.images,0); assert.equal((await store.readContent('projects',existing.path)).data.image,saved.data.image);
  const missing = await importArticle(store,{...source,text:'---\nimage: missing.png\n---\n# 缺图\n',assets:[],allowMissing:true});
  assert.equal((await store.readContent('projects',missing.path)).data.image,undefined);
});
