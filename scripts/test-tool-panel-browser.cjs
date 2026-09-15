const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/components/tool-panel');
    const demo = page.locator('.tool-panel-multiple-demo');
    const panel = demo.locator('.sia-tool-panel');
    await panel.waitFor();
    assert.equal(await panel.locator('.sia-tool-panel__activity').count(), 4);
    assert.equal(await panel.getByRole('region').count(), 1);
    assert(await panel.getByRole('button', { name: '展开历史面板' }).isDisabled());
    await panel.getByLabel('多面板搜索文件').fill('保留文件查询');
    await panel.getByRole('button', { name: '展开搜索面板' }).click();
    await panel.getByLabel('搜索项目内容').fill('保留搜索内容');
    await panel.getByRole('button', { name: '展开资源面板' }).click();
    assert.equal(await panel.getByLabel('多面板搜索文件').inputValue(), '保留文件查询');
    await page.getByRole('button', { name: '切换到搜索', exact: true }).click();
    assert.equal(await panel.getByLabel('搜索项目内容').inputValue(), '保留搜索内容');
    assert.equal(await panel.getByRole('region').count(), 1);

    let handle = panel.getByRole('separator');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await handle.getAttribute('aria-valuenow'), '272');
    const bounds = await handle.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + 20);
    await page.mouse.up();
    assert.equal(await handle.getAttribute('aria-valuenow'), '312');
    await panel.getByRole('button', { name: '收起搜索面板' }).click();
    assert.equal(await panel.getByRole('region').count(), 0);
    assert.equal(await panel.getByRole('separator').count(), 0);
    assert((await panel.boundingBox()).width < 50);
    await panel.getByRole('button', { name: '展开大纲面板' }).click();
    assert.equal(await panel.getByRole('separator').getAttribute('aria-valuenow'), '312');
    assert(await panel.getByText('页面大纲', { exact: true }).isVisible());
    await panel.getByRole('button', { name: '展开搜索面板' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await panel.getByLabel('搜索项目内容').inputValue(), '保留搜索内容');

    const right = page.locator('.sia-tool-panel--right');
    await right.getByRole('button', { name: '展开图层面板' }).click();
    assert(await right.getByText('画布图层', { exact: true }).isVisible());
    await right.getByRole('separator').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await right.getByRole('separator').getAttribute('aria-valuenow'), '262');
    await right.getByRole('button', { name: '收起图层面板' }).click();
    await right.getByRole('button', { name: '展开属性面板' }).click();
    assert(await right.getByLabel('节点名称').isVisible());

    const single = page.locator('.sia-tool-panel').first();
    await single.getByRole('button', { name: '收起资源面板' }).click();
    assert.equal(await single.getByRole('region').count(), 0);
    await single.getByRole('button', { name: '展开资源面板' }).click();
    assert(await single.getByLabel('搜索资源').isVisible());
    await demo.screenshot({ path: path.join(require('node:os').tmpdir(), 'sia-tool-panel-multiple.png') });
    assert.deepEqual(errors, []);
    console.log('ToolPanel: controlled/uncontrolled switching, state retention, collapse/reopen, disabled entries, mouse/keyboard resizing, right placement, and single-panel compatibility passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
