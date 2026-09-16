const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.locator('.sia-table__cell-content').first().waitFor();
    assert.equal(await page.locator('.sia-table__cell-content[title], .sia-table__summary-label[title]').count(), 0);
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      const host = document.createElement('div');
      host.id = 'tooltip-fixture';
      host.style = 'position:fixed;top:0;left:0;width:600px;z-index:999;background:white';
      document.body.append(host);
      createRoot(host).render(React.createElement(Table, {
        rowKey: 'id',
        columns: [
          { key: 'default', name: '默认无提示', width: 200 },
          { key: 'enabled', name: '显式启用', width: 200, showTitle: true },
          { key: 'disabled', name: '显式关闭', width: 200, showTitle: false },
        ],
        dataSource: [{ id: 1, default: '默认完整文本', enabled: '统一提示完整文本很长很长很长很长很长', disabled: '关闭提示' }],
      }));
    });
    const fixture = page.locator('#tooltip-fixture');
    const cells = fixture.locator('.sia-table__cell-content');
    await cells.first().waitFor();
    assert.equal(await fixture.locator('[title]').count(), 0);
    await cells.nth(0).hover();
    await page.waitForTimeout(400);
    assert.equal(await page.getByRole('tooltip').count(), 0);
    await cells.nth(1).locator('span').last().hover();
    await page.getByRole('tooltip').waitFor();
    assert.equal(await page.getByRole('tooltip').textContent(), '统一提示完整文本很长很长很长很长很长');
    assert(await cells.nth(1).evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await cells.nth(2).hover();
    await page.getByRole('tooltip').waitFor({ state: 'hidden' });
    console.log('PASS: default/disabled cells have no tooltip, no native title, explicit showTitle uses Sia Tooltip, ellipsis width preserved.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
