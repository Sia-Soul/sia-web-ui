const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
// 使用真实勾选交互验证隐藏入口后保留单行选择，恢复后全选仍然有效。
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4189/tests/table-select-all.html');
    const all = page.getByRole('checkbox', { name: '选择当前页全部行', exact: true });
    await all.waitFor();
    await page.getByRole('checkbox', { name: '选择第 1 行', exact: true }).press('Space');
    await page.getByRole('button', { name: '切换全选' }).click();
    assert.equal(await all.count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: '选择第 1 行', exact: true }).isChecked(), true);
    await page.getByRole('checkbox', { name: '选择第 2 行', exact: true }).press('Space');
    await page.getByRole('button', { name: '切换全选' }).click();
    assert.equal(await all.isChecked(), true);
    await all.press('Space');
    assert.equal(await page.getByRole('checkbox', { name: '选择第 1 行', exact: true }).isChecked(), false);
    console.log('PASS: 默认全选、隐藏表头入口、行勾选保留、恢复全选与取消全选');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
