/** 验证面板只向原生窗口报告可见表面，透明边距及尚未展开的子菜单不参与鼠标命中。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 628, height: 534 } });
    await page.addInitScript(() => {
      window.hitTest = { calls: [], update: null };
      const payload = { hitRegionRevision: 1, kind: 'extensions', darkMode: false, items: [], extensions: [] };
      window.__TAURI__ = { event: { listen: async (name, callback) => {
        if (name === 'sia://browser-menu-state') window.hitTest.update = callback;
        return () => {};
      } }, core: { invoke: async (command, args) => {
        window.hitTest.calls.push({ command, args });
        if (command === 'get_browser_menu_state') return payload;
        if (command === 'list_browser_extensions') return [];
      } } };
    });
    await page.goto('http://127.0.0.1:1440/menu.html');
    await page.locator('.browser-panel').waitFor();
    const latest = () => page.evaluate(() => window.hitTest.calls.filter(c => c.command === 'update_browser_menu_regions').at(-1)?.args);
    await page.waitForFunction(() => window.hitTest.calls.some(c => c.command === 'update_browser_menu_regions'), null, { timeout: 3000 });
    let report = await latest();
    assert.equal(report.revision, 1);
    assert.equal(report.regions.length, 1);
    assert.equal(report.regions[0].x, 20);
    assert.equal(report.regions[0].y, 20, '上方工具栏所在的透明留白不可命中');
    assert.equal(report.regions[0].width, 588);
    await page.evaluate(() => window.hitTest.update({ payload: {
      hitRegionRevision: 2, kind: 'menu', darkMode: false,
      menuLayout: { left: 20, top: 20, width: 304, height: 494 },
      items: [{ key: 'move', label: '移动到', children: [{ key: 'dest', label: '目标分组' }] }],
    } }));
    await page.waitForFunction(() => window.hitTest.calls.filter(c => c.command === 'update_browser_menu_regions').at(-1)?.args.revision === 2);
    assert.equal((await latest()).regions.length, 1, '子菜单未展开时不得占用透明画布');
    await page.getByRole('button', { name: '移动到', exact: true }).hover();
    await page.waitForFunction(() => window.hitTest.calls.filter(c => c.command === 'update_browser_menu_regions').at(-1)?.args.regions.length === 2);
    report = await latest();
    const popup = await page.locator('.sia-menu__popup.is-open').boundingBox();
    assert.equal(report.regions[1].x, popup.x, '子菜单只报告实际位置，包含框架的边缘重叠');
    assert.equal(report.regions[1].width, popup.width);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hitTest.calls.filter(c => c.command === 'update_browser_menu_regions').at(-1)?.args.regions.length === 1);
    console.log('PASS 工具面板透明边距、级联菜单展开与关闭、面板版本切换的原生命中范围');
    await page.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
