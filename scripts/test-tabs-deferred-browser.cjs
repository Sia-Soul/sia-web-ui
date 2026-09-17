const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 通过实际挂载计数检查面板时序，避免仅检查 CSS 或隐藏状态。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/tabs');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = dom.default ?? dom;
      const { Tabs } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Tabs.tsx');
      const host = document.createElement('div');
      host.id = 'deferred-test';
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:white';
      document.body.append(host);
      window.tabEvents = [];
      function Content({ name }) {
        React.useEffect(() => { window.tabEvents.push('mount:' + name); return () => window.tabEvents.push('unmount:' + name); }, []);
        return React.createElement('div', null, 'content:' + name);
      }
      const root = createRoot(host);
      window.renderDeferred = (props = {}) => root.render(React.createElement(Tabs, {
        type: 'tech-line', deferContent: true,
        onAfterChange: key => window.tabEvents.push('after:' + key),
        items: ['a', 'b', 'c'].map(key => ({ key, label: key, children: React.createElement(Content, { name: key }) })),
        ...props,
      }));
      window.renderDeferred();
    });
    const host = page.locator('#deferred-test');
    await host.getByText('content:a', { exact: true }).waitFor();
    await host.getByRole('tab', { name: 'b', exact: true }).click();
    await page.waitForTimeout(80);
    assert.ok(await host.getByText('content:a', { exact: true }).isVisible());
    assert.equal(await host.getByText('content:b', { exact: true }).count(), 0);
    await host.getByRole('tab', { name: 'c', exact: true }).click();
    await host.getByText('content:c', { exact: true }).waitFor();
    const events = await page.evaluate(() => window.tabEvents);
    assert.ok(!events.includes('mount:b') && !events.includes('after:b'));
    assert.equal(events.filter(e => e === 'after:c').length, 1);
    // 受控模式、保留已访问面板以及系统关闭动画均应正常完成。
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.renderDeferred({ activeKey: 'b', destroyInactiveTabPane: false }));
    await host.getByText('content:b', { exact: true }).waitFor();
    assert.equal(await host.getByText('content:c', { exact: true }).count(), 1);
    assert.equal(await host.getByText('content:c', { exact: true }).isVisible(), false);
    // 不开启延迟时仍然立即显示，与现有行为兼容。
    await page.evaluate(() => window.renderDeferred({ deferContent: false, activeKey: 'a' }));
    await host.getByText('content:a', { exact: true }).waitFor();
    console.log('PASS: 动画期间保留旧面板、不挂载中间目标、最终回调、受控切换、缓存面板、减少动态效果和即时模式。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
