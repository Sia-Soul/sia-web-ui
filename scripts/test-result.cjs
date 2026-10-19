// 结果展示检查省略区域、零值、自定义节点与语义状态；布局另用实际浏览器验证。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const requireUi = createRequire(require('node:path').resolve('packages/react/package.json'));
const React = requireUi('react');
const { renderToStaticMarkup } = requireUi('react-dom/server');
const build = createRequire(requireUi.resolve('tsup'))('esbuild');
build.buildSync({ entryPoints: ['packages/react/src/components/Result.tsx'], bundle: true, platform: 'node', format: 'cjs', external: ['react'], outfile: 'packages/react/logs-result-test.cjs' });
const { Result } = requireUi('./logs-result-test.cjs');
const render = props => renderToStaticMarkup(React.createElement(Result, props));
for (const status of ['success', 'error', 'info', 'warning']) assert.match(render({ status, title: '结果标题' }), new RegExp('sia-result--' + status));
assert.doesNotMatch(render({ icon: null }), /sia-result__icon|sia-result__title|sia-result__extra/);
assert.match(render({ title: 0, icon: false }), />0</);
assert.match(render({ icon: React.createElement('span', null, '自定义图标') }), /自定义图标/);
assert.match(render({ title: '<script>', subTitle: '说明', children: '详情', extra: React.createElement('button', null, '重试') }), /&lt;script&gt;/);
assert.match(render({ title: '成功', 'aria-label': '导入结果' }), /aria-label="导入结果"/);
// 浏览器用实际组件输出和真实样式，避免手工仿制效果图。
fs.mkdirSync('.tmp-result-test', { recursive: true });
// 完整基础样式包含 Icon 尺寸，不能只加载结果区样式冒充实际展示。
const css = fs.readFileSync('packages/react/dist/core.css', 'utf8') + fs.readFileSync('packages/react/src/components/result.css', 'utf8');
const iconsCss = fs.existsSync('packages/react/logs-result-test.css') ? fs.readFileSync('packages/react/logs-result-test.css', 'utf8') : '';
const content = ['success','error','info','warning'].map(status=>render({status,title:'导入结果',subTitle:'很长的错误说明与数据库字段_'.repeat(10),extra:React.createElement('button',null,'重新选择文件')})).join('');
fs.writeFileSync('.tmp-result-test/result.html', '<!doctype html><meta charset="utf-8"><style>body{margin:0;font-family:Arial}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));--sia-color-text:#20242a;--sia-color-text-secondary:#666;--sia-color-primary:#1677ff}</style><style>'+iconsCss+css+'</style><main>'+content+'</main>');
for (const ext of ['cjs','css']) { const file='packages/react/logs-result-test.'+ext; if(fs.existsSync(file)) fs.unlinkSync(file); }
console.log('PASS Result：四种状态、隐藏图标、零值、内容转义、自定义节点、无隐含操作');
