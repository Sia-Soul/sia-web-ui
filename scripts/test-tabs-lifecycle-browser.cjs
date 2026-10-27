const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 通过真实组件状态和挂载副作用验证缓存，覆盖受控、快速切换及删除后同键重建。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/tabs');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = dom.default ?? dom;
      const reactDom = await import('/node_modules/.vite/deps/react-dom.js');
      const { flushSync } = reactDom.default ?? reactDom;
      const { Tabs } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Tabs.tsx');
      const { Button } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Button.tsx');
      const host = document.createElement('div');
      host.id = 'lifecycle-test';
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:white';
      document.body.append(host);
      window.tabEvents = [];
      function Content({ name, version }) {
        const [count, setCount] = React.useState(0);
        // 挂载副作用模拟页面初始化请求，计数状态用于发现隐藏后的意外重建。
        React.useEffect(() => {
          window.tabEvents.push('mount:' + name);
          return () => window.tabEvents.push('unmount:' + name);
        }, []);
        return React.createElement(Button, { onClick: () => setCount(value => value + 1) }, `${name}:${count}:${version}`);
      }
      const root = createRoot(host);
      window.renderLifecycle = ({ keys = ['a', 'b', 'c'], version = 1, instance = 'default', ...props } = {}) => {
        flushSync(() => root.render(React.createElement(Tabs, {
          key: instance,
          type: 'tech-line',
          items: keys.map(key => ({ key, label: key, children: React.createElement(Content, { name: key, version }) })),
          ...props,
        })));
      };
      window.renderLifecycle();
    });
    const host = page.locator('#lifecycle-test');
    const events = () => page.evaluate(() => window.tabEvents);
    const panel = key => host.locator(`[role="tabpanel"][id$="-panel-${key}"]`);
    await host.getByRole('button', { name: 'a:0:1', exact: true }).click();
    assert.deepEqual(await events(), ['mount:a'], '默认只挂载初始面板');
    assert.equal(await panel('b').count(), 0);

    // 在动画结束前连续提交即时切换，先前显示过的面板也必须被记录并保留。
    await page.evaluate(async () => {
      const reactDom = await import('/node_modules/.vite/deps/react-dom.js');
      const { flushSync } = reactDom.default ?? reactDom;
      for (const key of ['b', 'a', 'b', 'a']) {
        flushSync(() => document.querySelector(`#lifecycle-test [role="tab"][id$="-tab-${key}"]`).click());
      }
    });
    assert.deepEqual(await events(), ['mount:a', 'mount:b'], '快速切换不重复触发挂载请求');
    assert.equal(await host.getByRole('button', { name: 'a:1:1', exact: true }).count(), 1);
    assert.equal(await panel('b').count(), 1);
    assert.equal(await panel('b').isVisible(), false);
    assert.equal(await panel('c').count(), 0);

    // 重新创建 items 及更新内容 props 仍保留状态，受控切换也采用首次访问挂载。
    await page.evaluate(() => window.renderLifecycle({ activeKey: 'b', version: 2 }));
    await host.getByRole('button', { name: 'b:0:2', exact: true }).click();
    await page.evaluate(() => window.renderLifecycle({ activeKey: 'a', version: 2 }));
    assert.equal(await host.getByRole('button', { name: 'a:1:2', exact: true }).count(), 1);
    assert.equal(await panel('b').textContent(), 'b:1:2');
    assert.deepEqual(await events(), ['mount:a', 'mount:b']);
    await page.evaluate(() => window.renderLifecycle({ activeKey: 'c' }));
    assert.deepEqual(await events(), ['mount:a', 'mount:b', 'mount:c']);

    // 从 items 删除时释放缓存；重新添加同键项后，访问前不能提前请求。
    await page.evaluate(() => window.renderLifecycle({ activeKey: 'a', keys: ['a', 'c'] }));
    assert.ok((await events()).includes('unmount:b'));
    await page.evaluate(() => window.renderLifecycle({ activeKey: 'a' }));
    assert.equal(await panel('b').count(), 0);
    await page.evaluate(() => window.renderLifecycle({ activeKey: 'b' }));
    assert.equal(await host.getByRole('button', { name: 'b:0:1', exact: true }).count(), 1);
    assert.equal((await events()).filter(event => event === 'mount:b').length, 2);

    // 显式销毁保留原有语义：切走清理、切回重置状态并重新执行初始化。
    await page.evaluate(() => window.renderLifecycle({ instance: 'destroy', destroyInactiveTabPane: true }));
    await page.evaluate(() => { window.tabEvents = []; });
    await host.getByRole('button', { name: 'a:0:1', exact: true }).click();
    await host.getByRole('tab', { name: 'b', exact: true }).click();
    assert.equal(await panel('a').count(), 0);
    await host.getByRole('tab', { name: 'a', exact: true }).click();
    assert.equal(await host.getByRole('button', { name: 'a:0:1', exact: true }).count(), 1);
    assert.deepEqual(await events(), ['unmount:a', 'mount:b', 'unmount:b', 'mount:a']);
    console.log('PASS: 默认懒挂载、快速切换保留状态与请求次数、受控及 props 更新、删除重加和显式销毁。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
