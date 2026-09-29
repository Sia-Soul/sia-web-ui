// 验证组件的双端值、0、清空入口以及禁用/只读渲染约定。
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const requireUi = createRequire(require('node:path').resolve('packages/react/package.json'));
const React = requireUi('react');
const {renderToStaticMarkup} = requireUi('react-dom/server');
// 单独打包新组件，避免 Node 18 加载整包时触发现有富文本 ESM/CJS 限制。
const requireBuild = createRequire(requireUi.resolve('tsup'));
requireBuild('esbuild').buildSync({entryPoints:['packages/react/src/components/NumberRange.tsx'],bundle:true,platform:'node',format:'cjs',external:['react'],outfile:'packages/react/logs-number-range-test.cjs'});
const {NumberRange} = requireUi('./logs-number-range-test.cjs');
// 测试打包还会生成图标依赖样式，一并清理，避免留下构建产物。
for (const extension of ['cjs', 'css']) {
  const generated = `packages/react/logs-number-range-test.${extension}`;
  if (require('node:fs').existsSync(generated)) require('node:fs').unlinkSync(generated);
}
const render = (props) => renderToStaticMarkup(React.createElement(NumberRange, props));
const zero = render({value:[0,null]});
assert.match(zero, /value="0"/);
assert.equal((zero.match(/role="spinbutton"/g)||[]).length, 2);
assert.match(zero, /清除数字区间/);
assert.doesNotMatch(render({value:[null,null]}), /清除数字区间/);
assert.doesNotMatch(render({value:[0,10],disabled:true}), /清除数字区间/);
assert.doesNotMatch(render({value:[0,10],readOnly:true}), /清除数字区间/);
assert.match(render({value:[1.2,3.4],precision:2}), /value="1.20"/);
assert.match(zero, /sia-number-range__separator/);
console.log('PASS NumberRange rendering: partial range, zero, clear, disabled, readonly, precision, separator');
