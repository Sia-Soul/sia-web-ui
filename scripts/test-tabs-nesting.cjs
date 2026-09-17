// 验证发布产物的嵌套选择器边界和内容间距，防止外层科技样式再次污染内层页签。
process.env.NODE_ENV = 'production';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const localRequire = createRequire(path.resolve(__dirname, '../packages/react/package.json'));
const React = localRequire('react');
const { renderToStaticMarkup } = localRequire('react-dom/server');
const { Tabs } = require('../packages/react/dist/core.cjs');
const css = fs.readFileSync(path.resolve(__dirname, '../packages/react/dist/index.css'), 'utf8');
assert(!/\.sia-tabs--[\w-]+(?:\.sia-tabs--[\w-]+)*\s+\.sia-tabs__/.test(css), '变体选择器不能跨越当前实例的直属导航或面板');
assert(css.includes('.sia-tabs--tech-line > .sia-tabs__header .sia-tabs__list::before'), '外层科技装饰必须限定在直属 header');
for (const [position, property] of [['top', 'padding-top'], ['bottom', 'padding-bottom'], ['left', 'padding-left'], ['right', 'padding-right']]) {
  const html = renderToStaticMarkup(React.createElement(Tabs, {
    tabPosition: position, contentGap: 0,
    items: [{ key: 'one', label: '测试', children: '内容' }],
  }));
  assert(html.includes(`${property}:0`), `${position} 应支持零间距`);
}
const inner = React.createElement(Tabs, { tabPosition: 'left', items: [{ key: 'inner', label: '内层', children: '内容' }] });
const nested = renderToStaticMarkup(React.createElement(Tabs, {
  type: 'tech-line', contentGap: 0,
  items: [{ key: 'outer', label: '外层', children: inner }],
}));
assert.equal((nested.match(/class="sia-tabs__panels" style=/g) || []).length, 1, '自定义间距只应设置在外层面板');
assert(nested.includes('sia-tabs--line'), '内层仍使用普通线型样式');
console.log('PASS Tabs selector isolation, four layout directions, and nested contentGap independence');
