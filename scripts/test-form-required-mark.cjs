// 回归验证标签节点不会被必填星号样式误伤，首次渲染不产生校验错误。
process.env.NODE_ENV = 'production';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const localRequire = createRequire(path.resolve(__dirname, '../packages/react/package.json'));
const React = localRequire('react');
const { renderToStaticMarkup } = localRequire('react-dom/server');
(async () => {
  // 只打包表单入口，避免服务端测试加载富文本编辑器的浏览器 CSS。
  const esbuild = createRequire(localRequire.resolve('tsup'))('esbuild');
  const bundled = esbuild.buildSync({entryPoints:[path.resolve(__dirname,'../packages/react/src/components/Form.tsx')], bundle:true, write:false, platform:'node', format:'cjs', packages:'external'});
  const Module = require('node:module');
  const filename = path.resolve(__dirname,'../packages/react/form-test.cjs');
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(bundled.outputFiles[0].text,filename);
  const { Form } = compiled.exports;
  const { Input, Tooltip } = require('../packages/react/dist/core.cjs');
  const css = fs.readFileSync(path.resolve(__dirname, '../packages/react/dist/index.css'), 'utf8');
  assert(!/\.sia-form-item__label\s*>\s*span/.test(css), '不得用直接 span 选择器给所有标签染色');
  assert(/\.sia-form-item__required-mark\s*\{[^}]*color:\s*var\(--sia-color-error\)/.test(css), '独立星号应保留必填色');
  const labels = ['普通标签', React.createElement('span', null, '节点标签'), React.createElement(Tooltip, {title:'说明'}, React.createElement('span',null,'提示标签'))];
  for (const label of labels) {
    for (const required of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(Form, {layout:'vertical'}, React.createElement(Form.Item, {name:'value', label, rules: required ? [{required:true}] : []}, React.createElement(Input))));
      assert.equal((html.match(/class="sia-form-item__required-mark"/g)||[]).length, required ? 1 : 0);
      assert(!html.includes('sia-form-item--error'), '初始空值不能显示校验错误');
      assert(!html.includes('aria-invalid="true"'), '初始空值不能标记输入错误');
    }
  }
  console.log('PASS: plain/span/Tooltip labels, required and optional marks, initial empty field without errors');
})().catch(error => { console.error(error); process.exitCode = 1; });
