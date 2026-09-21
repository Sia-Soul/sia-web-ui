const assert = require("node:assert/strict");
const { chromium } = require(process.argv[2] || "playwright");
// 使用真实浏览器核对行高、分支延续和展开收起，不以静态 CSS 扫描替代行为验收。
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
    await page.goto("http://127.0.0.1:4189/tests/table-tree-lines.html");
    await page.getByText("红色", { exact: true }).waitFor();
    const red = page.locator('.sia-table__tree-cell').filter({ hasText: '红色' });
    assert.equal(await red.locator('.sia-table__tree-guide').count(), 2);
    assert.equal(await red.locator('.sia-table__tree-guide--continued').count(), 1);
    const ear = page.locator('.sia-table__tree-cell').filter({ hasText: '耳机' });
    assert.equal(await ear.locator('.sia-table__tree-guide--continued').count(), 0);
    assert.ok(await red.evaluate(el => el.getBoundingClientRect().height >= 30));
    await page.getByRole('button', { name: '收起子节点', exact: true }).first().click();
    assert.equal(await page.getByText('红色', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '展开子节点', exact: true }).first().click();
    await page.getByText('红色', { exact: true }).waitFor();
    await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'sia-table-tree-lines.png') });
    // 虚拟滚动后，祖先未挂载的叶节点仍保留正确的两级分支。
    await page.locator('.sia-table__viewport').evaluate(el => { el.scrollTop = 2000; });
    await page.waitForTimeout(150);
    const leaf = page.locator('.sia-table__tree-cell').filter({ hasText: '运动款' }).first();
    assert.equal(await leaf.locator('.sia-table__tree-guide').count(), 2);
    assert.equal(await leaf.locator('.sia-table__tree-guide--continued').count(), 0);
    console.log('树形连接线分支、末尾、行高、展开收起和虚拟滚动通过');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
