// 真实控件回归：隐藏输入不能跨过内层滚动容器，点击、键盘及禁用仍沿用原生行为。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright-core'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Checkbox } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Checkbox.tsx');
      const { Radio } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Radio.tsx');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const root = createRoot(host);
      window.mountSelection = (kind, disabled, height) => root.render(React.createElement('div', { 'data-testid': 'outer', style: { position: 'relative', height: 400, overflow: 'auto' } },
        React.createElement('div', { 'data-testid': 'inner', style: { height, overflow: 'auto' } },
          Array.from({ length: 100 }, (_, index) => React.createElement('div', { key: kind + index }, React.createElement(kind === 'checkbox' ? Checkbox : Radio, { name: kind, disabled, value: index }, '选项' + index))))));
    });
    for (const kind of ['checkbox', 'radio']) {
      for (const height of [180, 280]) {
        await page.evaluate(args => window.mountSelection(...args), [kind, false, height]);
        await page.getByRole(kind, { name: '选项0', exact: true }).waitFor({ state: 'attached' });
        const geometry = await page.getByTestId('outer').evaluate(element => ({ height: element.clientHeight, scroll: element.scrollHeight }));
        assert.equal(geometry.height, geometry.scroll, `${kind} 外层被隐藏输入撑大`);
        const inner = page.getByTestId('inner');
        assert.ok(await inner.evaluate(element => element.scrollHeight > element.clientHeight));
        await page.getByText('选项0', { exact: true }).click();
        assert.equal(await page.getByRole(kind, { name: '选项0', exact: true }).isChecked(), true);
        await page.getByRole(kind, { name: '选项0', exact: true }).focus();
        await page.keyboard.press('Space');
        assert.equal(await page.getByRole(kind, { name: '选项0', exact: true }).isChecked(), kind === 'radio');
        await inner.hover();
        await page.mouse.wheel(0, 500);
        await page.waitForFunction(() => document.querySelector('[data-testid="inner"]').scrollTop > 0);
        assert.equal(await page.getByTestId('outer').evaluate(element => element.scrollTop), 0);
      }
      await page.evaluate(kind => window.mountSelection(kind, true, 180), kind);
      await page.waitForFunction(kind => document.querySelector(`input[type="${kind}"]`).disabled, kind);
      assert.equal(await page.getByRole(kind, { name: '选项0', exact: true }).isDisabled(), true);
    }
    console.log('PASS Checkbox/Radio：长列表独立滚动、两种容器高度、点击、键盘和禁用状态。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
