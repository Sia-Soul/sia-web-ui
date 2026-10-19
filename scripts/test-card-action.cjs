// 运行真实 Card 的事件处理，验证整卡执行与内部控件、禁用和选择模式互不干扰。
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const exportsObject = {};
const jsx = (type, props) => ({ type, props });
const code = ts.transpileModule(fs.readFileSync('packages/react/src/components/Card.tsx', 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { exports: exportsObject, require: id => {
  if (id === 'react') return { useState: value => [value, () => {}] };
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (id === './titleTooltip') return { withTitleTooltip: props => props };
  if (id === './Icon') return { Icon: () => null };
  throw new Error(id);
} });
let calls = 0;
const card = exportsObject.Card({ onAction: () => calls++ }).props;
const root = {};
function event(key, nested = false) {
  return { key, target: nested ? { closest: () => ({}) } : root, currentTarget: root, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; } };
}
root.closest = () => root;
assert.equal(card.role, 'button');
assert.equal(card.tabIndex, 0);
card.onClick(event());
card.onKeyDown(event('Enter'));
card.onKeyDown(event(' '));
assert.equal(calls, 3);
card.onClick(event(undefined, true));
card.onKeyDown(event('Enter', true));
assert.equal(calls, 3, '内部控件不触发整卡操作');
const disabled = exportsObject.Card({ onAction: () => calls++, disabled: true }).props;
disabled.onClick(event()); disabled.onKeyDown(event('Enter'));
assert.equal(disabled.tabIndex, undefined);
assert.equal(calls, 3);
let selected = false;
const selection = exportsObject.Card({ selectable: true, onAction: () => calls++, onSelectedChange: value => selected = value }).props;
selection.onClick(event());
assert.equal(selected, true); assert.equal(calls, 3); assert.equal(selection.role, 'checkbox');
const intercepted = exportsObject.Card({ onAction: () => calls++, onClick: e => e.preventDefault() }).props;
intercepted.onClick(event()); assert.equal(calls, 3);
// fill 只改变布局语义，不改变默认内容高度；显式正文高度继续具有优先级。
const filling = exportsObject.Card({ fill: true }).props;
assert.match(filling.className, /sia-card--fill/);
const fixed = exportsObject.Card({ fill: true, bodyHeight: 120 }).props;
assert.match(fixed.className, /sia-card--body-height/);
assert.doesNotMatch(exportsObject.Card({}).props.className, /sia-card--fill/);
console.log('Card 整卡执行：鼠标、键盘、内部控件、禁用、选择优先及阻止默认行为通过');
