import path from 'node:path';
import { promises as fs } from 'node:fs';
import yaml from 'js-yaml';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import { AdminError, relativeName, safePath, slug, hash, validateContent, decodeUpload } from './lib.mjs';

const imageType = /\.(png|jpe?g|gif|webp|avif)$/i;
const cleanPath = value => value.replace(/\\/g, '/');
const filename = value => path.posix.basename(cleanPath(value));
const plain = node => node.value ?? (node.children || []).map(plain).join('');
function decoded(value) { try { return decodeURIComponent(value); } catch { return value; } }

// 使用 Markdown 语法树定位图片，代码块、行内代码中的示例保持原样。
export function imageReferences(body) {
  const tree = fromMarkdown(body), refs = [], definitions = new Map(), used = new Set();
  visit(tree, 'definition', node => definitions.set(node.identifier, node));
  const add = (node, url, replacement) => {
    if (/^(?:https?:|data:|\/\/)/i.test(url)) return;
    refs.push({ url, start:node.position.start.offset, end:node.position.end.offset, replacement });
  };
  const markdownImage = (node, url) => `![${(node.alt || '').replace(/[\\\[\]]/g, '\\$&')}](<${url}>${node.title ? ` "${node.title.replace(/["\\]/g, '\\$&')}"` : ''})`;
  visit(tree, node => {
    if (node.type === 'image') add(node, node.url, url => markdownImage(node, url));
    if (node.type === 'imageReference' && !used.has(node.identifier)) {
      used.add(node.identifier); const def = definitions.get(node.identifier);
      if (def) add(def, def.url, url => `[${def.label || def.identifier}]: <${url}>${def.title ? ` "${def.title.replace(/["\\]/g, '\\$&')}"` : ''}`);
    }
    if (node.type === 'text') {
      const source = body.slice(node.position.start.offset, node.position.end.offset);
      for (const match of source.matchAll(/!\[\[([^\]\n]+)\]\]/g)) {
        const [url, label] = match[1].split('|');
        const start = node.position.start.offset + match.index;
        add({ position:{ start:{offset:start}, end:{offset:start + match[0].length} } }, url.trim(), next => `![${(label || filename(url)).replace(/[\\\[\]]/g, '\\$&')}](<${next}>)`);
      }
    }
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
        const start = node.position.start.offset + match.index;
        add({ position:{ start:{offset:start}, end:{offset:start + match[0].length} } }, match[2], next => match[0].replace(/(\bsrc\s*=\s*)(["'])(.*?)\2/i, (_all, prefix, quote) => prefix + quote + next + quote));
      }
    }
  });
  return refs;
}

export async function prepareImport(store, input) {
  if (!input || typeof input.name !== 'string' || !/\.md$/i.test(input.name) || filename(input.name) !== input.name) throw new AdminError('请选择一个 .md 格式的 Markdown 文章。');
  if (typeof input.text !== 'string' || input.text.length > 2_000_000 || input.text.includes('\0')) throw new AdminError('文章内容无效或超过 2 MB，请使用 UTF-8 编码的 Markdown 文件。');
  let body = input.text.replace(/^\uFEFF/, ''), data = {}, notes = [];
  if (/^---\r?\n/.test(body)) {
    const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new AdminError('文章顶部的 YAML 属性区没有结束，请补全 --- 后重新导入。');
    try { data = yaml.load(match[1], {schema:yaml.JSON_SCHEMA}) || {}; }
    catch (error) { throw new AdminError('文章顶部的 YAML 属性格式错误：' + error.message); }
    if (typeof data !== 'object' || Array.isArray(data)) throw new AdminError('文章顶部属性区必须是键值对。');
    body = body.slice(match[0].length);
  }
  let heading;
  visit(fromMarkdown(body), 'heading', node => { if (!heading && node.depth === 1) heading = plain(node); });
  data.title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : heading || input.name.slice(0, -3);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : new Date().toISOString().slice(0,10);
  if (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data.date)) data.date = data.date.slice(0,10);
  else { data.date = today; notes.push('原文没有有效日期，使用所选文件的修改日期。'); }
  if (typeof data.tags === 'string') data.tags = data.tags.split(/[,，\s]+/).filter(Boolean);
  if (data.tags == null) data.tags = [];
  if (data.description == null) data.description = '';
  if (data.category == null) delete data.category;
  data.draft = true;
  if ('slug' in data) { delete data.slug; notes.push('使用新文件名生成网址，保留原文章。'); }
  validateContent('blog', data);
  const entries = await store.listContent('blog');
  const occupied = new Set(entries.map(entry => slug(entry.path)));
  const base = slug(input.name.replace(/\.md$/i, '.md')).slice(0,100) || 'imported-article';
  let name = base, count = 2;
  while (occupied.has(name)) name = `${base}-${count++}`;
  const destination = `${name}.md`; relativeName(destination, '.md');
  const references = imageReferences(body);
  return {data, body, path:destination, notes, references};
}

function assetMatch(url, assets) {
  const target = cleanPath(decoded(url.split(/[?#]/)[0]).replace(/^file:\/\//i, ''));
  const wanted = target.replace(/^(?:\.\.\/|\.\/|\/)+/g, '');
  const exact = assets.filter(asset => asset.path === wanted || asset.path.endsWith('/' + wanted));
  if (exact.length === 1) return exact[0];
  const names = assets.filter(asset => filename(asset.path).toLowerCase() === filename(target).toLowerCase());
  if (names.length > 1 || exact.length > 1) throw new AdminError(`图片「${url}」存在多个同名文件。请选择更精确的附件文件夹，避免导入错误图片。`);
  return names[0];
}

export async function importArticle(store, input) {
  const prepared = await prepareImport(store, input);
  if (!Array.isArray(input.assets) || input.assets.length > 300) throw new AdminError('附件数量无效，每次最多导入 300 张图片。');
  const assets = input.assets.map(asset => {
    if (!asset || typeof asset.path !== 'string' || asset.path.length > 1200 || /[\0-\x1f]/.test(asset.path)) throw new AdminError('附件文件名不合法。');
    return {...asset, path:cleanPath(asset.path)};
  });
  if (new Set(assets.map(a => a.path)).size !== assets.length) throw new AdminError('附件路径重复，请重新选择图片。');
  const needed = new Map(), missing = [], replacements = [];
  for (const ref of prepared.references) {
    // 网站中已有的素材可直接继续使用。
    if (/^\/(?!\/)/.test(ref.url)) {
      const name = decoded(ref.url.split(/[?#]/)[0].slice(1));
      try { relativeName(name); if (imageType.test(name) && (await fs.stat(await safePath(store.root, 'public/' + name))).isFile()) continue; } catch {}
    }
    const asset = assetMatch(ref.url, assets);
    if (!asset || !imageType.test(asset.path)) { missing.push(ref.url); continue; }
    if (!needed.has(asset.path)) {
      // 验证所有需要的图片后才开始落盘，避免错误附件产生半篇文章。
      const bytes = decodeUpload({bucket:'blog-assets', name:filename(asset.path), base64:asset.base64});
      needed.set(asset.path, {asset, bytes});
    }
    replacements.push({...ref, assetPath:asset.path});
  }
  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length && input.allowMissing !== true) throw new AdminError('以下本地图片尚未选择：' + uniqueMissing.join('、') + '。请选择配图或所在文件夹，也可勾选「缺失图片稍后补充」。');
  const created = [], urls = new Map();
  try {
    for (const [key, {asset, bytes}] of needed) {
      const saved = await store.upload({bucket:'blog-assets',name:filename(asset.path),base64:asset.base64});
      created.push({relative:`public/blog-assets/${saved.name}`, version:hash(bytes)}); urls.set(key, saved.url);
    }
    let body = prepared.body;
    for (const ref of replacements.sort((a,b) => b.start - a.start)) body = body.slice(0,ref.start) + ref.replacement(urls.get(ref.assetPath)) + body.slice(ref.end);
    await store.writeContent({collection:'blog',path:prepared.path,data:prepared.data,body,version:null});
    return {path:prepared.path,title:prepared.data.title,images:needed.size,missing:uniqueMissing};
  } catch (error) {
    for (const item of created) {
      const target = await safePath(store.root,item.relative);
      // 只清理本次新建且未被其他编辑器修改的图片。
      try { if (hash(await fs.readFile(target)) === item.version) await fs.unlink(target); } catch {}
    }
    throw error;
  }
}
