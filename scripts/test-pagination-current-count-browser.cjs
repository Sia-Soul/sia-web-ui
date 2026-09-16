const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/pagination');
    const basic = page.locator('.demo-card').filter({ has: page.getByRole('heading', { name: '基础分页', exact: true }) });
    const count = basic.locator('.sia-pagination__current-count');
    await count.waitFor();
    assert.equal(await count.textContent(), '当前页 25 条');
    assert(await count.evaluate(node => node.parentElement.firstElementChild === node));
    await basic.getByRole('button', { name: '最后一页', exact: true }).click();
    assert.equal(await count.textContent(), '当前页 11 条');
    await basic.getByRole('button', { name: '上一页', exact: true }).click();
    assert.equal(await count.textContent(), '当前页 25 条');
    await basic.getByRole('combobox', { name: '每页条数' }).click();
    await page.getByRole('option', { name: '10 条', exact: true }).click();
    assert.equal(await count.textContent(), '当前页 10 条');
    await basic.getByRole('button', { name: '最后一页', exact: true }).click();
    assert.equal(await count.textContent(), '当前页 6 条');
    const examples = page.locator('.demo-card').filter({ has: page.getByRole('heading', { name: '当前页条数', exact: true }) });
    assert.deepEqual(await examples.locator('.sia-pagination__current-count').allTextContents(), ['当前页 3 条', '当前页 0 条', '当前页 7 条']);
    await page.goto('http://127.0.0.1:4173/components/table');
    const table = page.locator('.demo-card').filter({ has: page.getByRole('heading', { name: '插件组合', exact: true }) });
    await table.locator('.sia-pagination__current-count').waitFor();
    assert.equal(await table.locator('.sia-pagination__current-count').textContent(), '当前页 25 条');
    await table.getByRole('combobox', { name: '每页条数' }).click();
    await page.getByRole('option', { name: '10 条', exact: true }).click();
    await table.getByRole('button', { name: '最后一页', exact: true }).click();
    assert.equal(await table.locator('.sia-pagination__current-count').textContent(), '当前页 5 条');
    await table.locator('.sia-pagination').screenshot({ path: path.join(require('node:os').tmpdir(), 'sia-pagination-current-count.png') });
    console.log('Pagination current-page count: leading position, page changes, page-size changes, last page, empty data, explicit server count and Table integration passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
