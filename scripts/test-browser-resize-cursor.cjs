/** 验证侧栏宽度拖动使用水平缩放指针，并保持实际拖动与 Tree 节点的默认指针。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    // 新建上下文使用独立的预览数据，不读取用户安装版的会话。
    const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
    await page.goto('http://127.0.0.1:1440/');
    const handle = page.getByRole('separator', { name: '调整标签面板宽度' });
    await handle.waitFor();
    await handle.hover();
    assert.equal(await handle.evaluate(el => getComputedStyle(el).cursor), 'ew-resize');
    const panel = page.locator('.vertical-tab-tree');
    const before = await panel.boundingBox();
    await page.mouse.down();
    await page.mouse.move(before.x + before.width + 30, before.y + before.height / 2, { steps: 5 });
    assert.equal(await handle.evaluate(el => getComputedStyle(el).cursor), 'ew-resize');
    await page.mouse.up();
    assert.ok((await panel.boundingBox()).width > before.width, '拖动后侧栏应变宽');
    const node = page.locator('.vertical-tab-tree__scroll .sia-button').first();
    assert.equal(await node.evaluate(el => getComputedStyle(el).cursor), 'default');
    console.log('PASS 侧栏悬停及拖动使用水平缩放指针，宽度调整正常，Tree 节点保留默认指针');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
