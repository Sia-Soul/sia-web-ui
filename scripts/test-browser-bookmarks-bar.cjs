/** 使用虚构收藏和模拟原生命令验证标题区布局，不启动桌面程序或读取用户数据。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://bookmark-*.example/**', route => route.abort());
    await page.addInitScript(() => {
      const listeners = new Map();
      window.bookmarkTest = { calls: [], emit: action => {
        for (const handler of listeners.get('sia://native-menu-action') || []) handler({ payload: action });
      } };
      window.__TAURI__ = {
        event: { listen: async (name, callback) => {
          const callbacks = listeners.get(name) || new Set();
          callbacks.add(callback);
          listeners.set(name, callbacks);
          return () => callbacks.delete(callback);
        } },
        core: { invoke: async (command, args) => {
          window.bookmarkTest.calls.push({ command, args });
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return {
            // 旧会话即使保存顶部布局，也必须恢复为左侧树形标签。
            version: 3, activeId: 'test', tabLayout: 'horizontal', layoutPreferenceSet: true,
            verticalPanelPinned: true, showBookmarksBar: false, groups: [],
            tabs: [{ id: 'test', title: '新标签页', url: '', groupId: 'group-other', loading: false,
              hasWebview: false, sleeping: false, audible: false, muted: false }],
            bookmarks: Array.from({ length: 24 }, (_, index) => ({
              title: `测试收藏 ${index}`, url: `https://bookmark-${index}.example/path`,
            })),
          };
        } },
      };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/');
    await page.waitForFunction(() => window.bookmarkTest.calls.some(call => call.command === 'open_floating_tab_panel'));
    assert.equal(await page.locator('.vertical-tab-panel-main').count(), 1);
    assert.equal(await page.locator('.horizontal-tab-strip').count(), 0);
    await page.waitForFunction(() => window.bookmarkTest.calls.some(call => call.command === 'save_browser_state'));
    const saved = await page.evaluate(() => window.bookmarkTest.calls.find(call => call.command === 'save_browser_state').args.state);
    assert.equal(Object.hasOwn(saved, 'tabLayout'), false, '新会话不再持久化布局切换偏好');
    assert.equal(Object.hasOwn(saved, 'layoutPreferenceSet'), false);
    assert.equal(saved.tabs[0].id, 'test', '迁移布局不能丢失原标签');
    await page.getByRole('button', { name: '更多', exact: true }).click();
    assert.equal(await page.evaluate(() => Object.hasOwn(window.bookmarkTest.calls.find(call =>
      call.command === 'show_browser_more_menu').args, 'tabLayout')), false);
    const bounds = selector => page.locator(selector).boundingBox();
    const before = await bounds('.browser-page-host');
    const addressBefore = await bounds('.address-input');
    await page.evaluate(() => window.bookmarkTest.emit('more:bookmark-bar'));
    const bar = page.getByRole('navigation', { name: '收藏夹栏' });
    await bar.waitFor();
    assert.equal(await page.locator('.browser-titlebar-area .bookmarks-bar').count(), 1);
    const barBounds = await bar.boundingBox();
    const header = await bounds('.browser-titlebar-area');
    const after = await bounds('.browser-page-host');
    assert.equal(barBounds.height, 32);
    assert.equal(after.y - before.y, 32, '网页应随标题区增高下移');
    assert.equal(header.y + header.height, barBounds.y + barBounds.height);
    assert.equal(barBounds.x, header.x, '收藏夹栏跨越整个窗口，不局限于网页内容列');
    assert.equal(barBounds.width, header.width);
    assert.deepEqual(await bounds('.address-input'), addressBefore, '地址栏及窗口控制行保持原高度');
    await page.waitForFunction(y => window.bookmarkTest.calls.some(call =>
      call.command === 'open_floating_tab_panel' && call.args.bounds.y === y), barBounds.y + barBounds.height);
    await page.waitForFunction(y => window.bookmarkTest.calls.some(call =>
      call.command === 'set_browser_bounds' && call.args.bounds.y === y), after.y);
    // 仅截取本次修改的标题区；禁用动画，避免主题过渡影响视觉核验。
    await page.locator('.browser-titlebar-area').screenshot({ path: 'logs/browser-bookmarks-bar-light.png', animations: 'disabled' });
    await page.evaluate(() => window.bookmarkTest.emit('more:theme'));
    await page.waitForFunction(() => document.documentElement.getAttribute('data-sia-theme') === 'dark');
    await page.locator('.browser-titlebar-area').screenshot({ path: 'logs/browser-bookmarks-bar-dark.png', animations: 'disabled' });
    await page.evaluate(() => window.bookmarkTest.emit('more:theme'));
    // 溢出项通过原生收藏面板访问，避免菜单被网页子 WebView 遮挡。
    await bar.getByRole('button', { name: '更多收藏' }).click();
    await page.waitForFunction(() => window.bookmarkTest.calls.some(call =>
      call.command === 'show_browser_panel' && call.args.payload.kind === 'bookmarks'));
    await bar.getByRole('button', { name: '测试收藏 0', exact: true }).click();
    await page.waitForFunction(() => window.bookmarkTest.calls.some(call =>
      call.command === 'open_browser_tab' && call.args.url === 'https://bookmark-0.example/path'));
    await page.evaluate(() => window.bookmarkTest.emit('more:bookmark-bar'));
    await bar.waitFor({ state: 'detached' });
    assert.equal((await bounds('.browser-page-host')).y, before.y);
    // 旧版切换事件不能恢复顶部模式；之后重新打开收藏栏仍只有左侧树。
    await page.evaluate(() => window.bookmarkTest.emit('more:tab-layout'));
    await page.evaluate(() => window.bookmarkTest.emit('more:bookmark-bar'));
    await bar.waitFor();
    assert.equal(await page.locator('.horizontal-tab-strip, .browser-toolbar').count(), 0);
    assert.equal(await page.locator('.vertical-tab-panel-main').count(), 1);
    await page.setViewportSize({ width: 960, height: 640 });
    assert.equal((await bar.boundingBox()).height, 32, '窄窗口保持单行');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // 设置页属于窗口内容，不能使已开启的标题区收藏栏消失。
    await page.evaluate(() => window.bookmarkTest.emit('more:settings'));
    await page.waitForFunction(() => document.querySelector('.browser-settings-page'));
    assert.equal(await bar.count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS 收藏夹栏与树形标签：标题区增高、全宽排列、开关恢复、原生边界同步、收藏导航、旧布局迁移、移除布局切换及窄窗口。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
