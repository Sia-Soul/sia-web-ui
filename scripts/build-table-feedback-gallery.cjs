// 验收图册只引用实际浏览器截图和录屏，明确框架回归与业务接入的边界。
const fs = require('node:fs'), path = require('node:path');
const root = 'logs/table-feedback';
const result = JSON.parse(fs.readFileSync(path.join(root, 'result.json'), 'utf8'));
const videos = fs.readdirSync(root).filter(x => x.endsWith('.webm')).sort((a, b) => fs.statSync(path.join(root, b)).mtimeMs - fs.statSync(path.join(root, a)).mtimeMs);
const sections = [['text-selection', '原生局部文字选择'], ['sorted', '排序按钮浮动与键盘操作'], ['wheel-0', '水平滚轮过程 1'], ['wheel-1', '水平滚轮过程 2'], ['wheel-2', '水平滚轮过程 3'], ['table', '水平滚动后'], ['narrow', '1000px 窄桌面']];
fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Table 五项反馈：框架回归</title><style>body{margin:24px;background:#f3f6fa;color:#22314a;font:15px/1.6 system-ui}main{max-width:1500px;margin:auto}section{padding:20px;margin:20px 0;background:white;border-radius:12px}img,video{max-width:100%;border:1px solid #ddd}li{margin:5px 0}</style><main><h1>Table 框架回归 · 2026-11-06</h1><p>真实 Edge、5000 行受控数据。以下是框架实际渲染效果，正式业务页面需等待发布并升级后复测，不代替业务验收。</p><section><h2>专项检查 ${result.checks.length} 项通过</h2><ul>${result.checks.map(x => `<li>${x}</li>`).join('')}</ul><p>另复测既有 DOM 选字/跨格复制，以及 100 / 500 / 1000 行 Canvas 勾选、操作、排序、调宽、列设置和虚拟化。</p></section>${videos.length ? `<section><h2>真实操作录屏</h2><video controls src="${videos[0]}"></video></section>` : ''}${sections.map(([file, title]) => `<section><h2>${title}</h2><img src="${file}.png"></section>`).join('')}</main>`, 'utf8');
console.log(path.resolve(root, 'index.html'));
