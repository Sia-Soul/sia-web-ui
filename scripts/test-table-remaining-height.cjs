/** 通过真实 Chromium 布局验证高度，不以模拟 DOM 的几何值代替浏览器验收。 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const open = async mode => {
      await page.goto(`http://127.0.0.1:4189/tests/table-remaining-height.html?mode=${mode}`);
      await page.locator('#table').waitFor({ state: 'attached' });
    };
    const expectFit = async (container = false, offset = 12) => {
      await page.waitForFunction(({ container, offset }) => {
        const table = document.querySelector('#table').getBoundingClientRect();
        const boundary = document.querySelector('#container').getBoundingClientRect();
        const bottom = container ? boundary.bottom - 10 : innerHeight;
        return table.height > 0 && Math.abs(table.bottom - (bottom - offset)) < 2;
      }, { container, offset });
    };
    await open('viewport'); await expectFit();
    const initial = await page.locator('#table').boundingBox();
    await page.getByText('切换查询', { exact: true }).click(); await expectFit();
    const expanded = await page.locator('#table').boundingBox();
    assert.equal(Math.round(initial.height - expanded.height), 100);
    await page.setViewportSize({ width: 900, height: 600 }); await expectFit();
    await page.locator('.sia-table__viewport').evaluate(el => { el.scrollTop = 1500; });
    await expectFit();
    await open('container'); await expectFit(true);
    await page.locator('#container').evaluate(el => { el.style.height = '400px'; }); await expectFit(true);
    await page.getByText('切换查询', { exact: true }).click(); await expectFit(true);
    await open('hidden');
    await page.locator('#panel').evaluate(el => { el.style.display = 'block'; }); await expectFit();
    await page.locator('#panel').evaluate(el => { el.style.transition = 'transform 100ms'; el.style.transform = 'translateY(20px)'; });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#panel')).transform === 'matrix(1, 0, 0, 1, 0, 20)');
    await expectFit();
    await page.locator('#panel').evaluate(el => { el.style.display = 'none'; });
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.locator('#panel').evaluate(el => { el.style.display = 'block'; }); await expectFit();
    await open('explicit'); assert.equal(Math.round((await page.locator('#table').boundingBox()).height), 240);
    await page.getByText('切换查询', { exact: true }).click();
    assert.equal(Math.round((await page.locator('#table').boundingBox()).height), 240);
    await open('empty'); await expectFit();
    await open('boolean'); await expectFit(false, 0);
    await open('minimum'); await page.setViewportSize({ width: 900, height: 120 });
    await page.waitForFunction(() => Math.round(document.querySelector('#table').getBoundingClientRect().height) === 180);
    assert.deepEqual(errors, []);
    console.log('PASS: viewport/container resize, query collapse, hidden tabs, explicit height, empty data, boolean mode, minHeight, virtual scroll; no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
