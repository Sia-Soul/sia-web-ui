/** 隔离原生面板，验证最近关闭语义、收藏夹 Tree、图标失败恢复与扩展悬停。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 560, height: 900 } });
    await page.addInitScript(() => {
      window.panelTest = { handlers: {}, calls: [], iconCalls: 0, payload: {
        kind: 'history', items: [], entries: [{ id: 'visit', title: '仅访问未关闭', url: 'https://visit.test', timestamp: Date.now() }],
        closedEntries: [{ id: 'closed', title: '已关闭页面', url: 'https://closed.test', timestamp: Date.now(), children: [] },
          { id: 'group', title: '开发分组', timestamp: Date.now(), children: [{ id: 'tab1', title: '组内页面', url: 'https://group.test' }] }],
      } };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.panelTest.handlers[name] = handler; return () => {}; } }, core: { invoke: async (command, args) => {
        const state = window.panelTest; state.calls.push({ command, args });
        if (command === 'get_browser_menu_state') return state.payload;
        if (command === 'list_browser_extensions') return state.payload.extensions;
        if (command === 'get_download_file_icon') { state.iconCalls++; return state.iconCalls === 1 ? null : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; }
      } } };
    });
    await page.goto('http://127.0.0.1:1440/menu.html');
    await page.getByText('仅访问未关闭', { exact: true }).waitFor();
    await page.getByRole('button', { name: '最近关闭', exact: true }).click();
    await page.getByText('已关闭页面', { exact: true }).waitFor({ timeout: 2000 });
    assert.equal(await page.getByText('仅访问未关闭', { exact: true }).count(), 0);
    await page.getByRole('treeitem').filter({ hasText: '开发分组' }).locator('.sia-tree__switcher').click();
    await page.getByText('组内页面', { exact: true }).waitFor();
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/recent-closed-tree.png' });
    // 重用面板载荷事件，保留宿主与真实 Tree 的键盘、展开行为。
    const load = async payload => page.evaluate(payload => {
      window.panelTest.payload = { items: [], ...payload };
      window.panelTest.handlers['sia://browser-menu-state']({ payload: window.panelTest.payload });
    }, payload);
    await load({ kind: 'bookmarks', entries: [{ id: 'folder', folder: true, title: '技术收藏' }, { id: 'link', title: '框架文档', parentId: 'folder', url: 'https://docs.test' }] });
    const folder = page.getByRole('treeitem').filter({ hasText: '技术收藏' }).last();
    await folder.locator('.sia-tree__switcher').click();
    await page.getByText('框架文档', { exact: true }).waitFor();
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/bookmarks-tree.png' });
    await load({ kind: 'extensions', extensions: [{ id: 'ext', name: '测试扩展', enabled: true }] });
    const row = page.locator('.browser-extension-row');
    await page.mouse.move(0, 0); await page.waitForTimeout(220);
    const normal = await row.evaluate(el => getComputedStyle(el).backgroundColor);
    await row.hover(); await page.waitForTimeout(220);
    assert.notEqual(await row.evaluate(el => getComputedStyle(el).backgroundColor), normal);
    await load({ kind: 'downloads', entries: [{ id: 'download', title: '模板.xlsx', state: 'finished', success: true }] });
    await page.locator('.browser-download-entry__icon img').waitFor({ timeout: 4000 });
    assert.ok(await page.evaluate(() => window.panelTest.iconCalls >= 2), '失败查询必须允许重试');
    console.log('PASS 最近关闭独立数据、整组展开、收藏夹框架 Tree、扩展悬停、图标失败重试');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
