// 使用真实浏览器几何位置与命中测试，防止合计虽存在于 DOM 却被空态遮住。
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2]);
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4189/tests/table-empty-summary.html');
    const check = async () => {
      await page.waitForFunction(() => {
        const summary = document.querySelector('tfoot');
        const empty = document.querySelector('.sia-table__empty');
        const viewport = document.querySelector('.sia-table__viewport');
        if (!summary || !empty || !viewport) return false;
        const s = summary.getBoundingClientRect(), e = empty.getBoundingClientRect(), v = viewport.getBoundingClientRect();
        return e.bottom <= s.top + 2 && Math.abs(s.bottom - v.bottom) < 2 && summary.contains(document.elementFromPoint(s.x + 20, s.y + 12));
      });
      assert.match(await page.locator('tfoot').innerText(), /合计/);
    };
    await check();
    await page.locator('#container').evaluate(e => { e.style.height = '260px'; });
    await check();
    await page.getByRole('button', { name: '切换数据' }).click();
    await page.locator('.sia-table__empty').waitFor({ state: 'detached' });
    assert.match(await page.locator('tfoot').innerText(), /4/);
    await page.getByRole('button', { name: '切换数据' }).click();
    await check();
    assert.deepEqual(errors, []);
    console.log('PASS 空表双合计可见、容器缩放、数据切换、无浏览器异常');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
