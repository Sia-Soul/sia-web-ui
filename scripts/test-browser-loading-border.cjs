/** 使用虚构网页检查加载边框与原生网页坐标，避免流光被 WebView 覆盖或引起布局跳动。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const pinned of [true, false]) {
      const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
      await page.addInitScript(pinned => {
        const listeners = new Map();
        window.loadingTest = { bounds: null, emit: (name, payload) => listeners.get(name)?.({ payload }) };
        window.__TAURI__ = { event: { listen: async (name, callback) => { listeners.set(name, callback); return () => {}; } }, core: { invoke: async (command, args) => {
          if (command === 'current_window_label') return 'main';
          if (command === 'set_browser_bounds') window.loadingTest.bounds = args.bounds;
          if (command === 'load_browser_state') return { version: 3, activeId: 'test', verticalPanelPinned: pinned, groups: [], bookmarks: [],
            tabs: [{ id: 'test', title: '测试页面', url: '', loading: false, hasWebview: false, sleeping: false }] };
        } } };
      }, pinned);
      await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1440/');
      const input = page.getByRole('textbox', { name: '地址和搜索栏' });
      await input.fill('https://loading.example/');
      await input.press('Enter');
      const line = page.locator('.browser-loading-line');
      await line.waitFor();
      // 明暗主题、收藏栏与窗口宽度都不应改变边框和网页的对齐关系。
      for (const width of [1380, 960]) {
        await page.setViewportSize({ width, height: 860 });
        for (const dark of [false, true]) {
          await page.evaluate(dark => document.documentElement.setAttribute('data-sia-theme', dark ? 'dark' : 'light'), dark);
          const host = await page.locator('.browser-page-host').boundingBox();
          const border = await line.boundingBox();
          assert.equal(border.x, host.x);
          assert.equal(border.width, host.width);
          assert.equal(border.y + border.height, host.y, '流光必须完整位于原生网页的上方');
          await page.waitForFunction(y => window.loadingTest.bounds?.y === Math.round(y), host.y);
          assert.equal(await page.locator('.browser-titlebar-area .browser-loading-line').count(), 0);
        }
      }
      await page.evaluate(() => window.loadingTest.emit('sia://native-menu-action', 'more:bookmark-bar'));
      await page.locator('.bookmarks-bar').waitFor();
      const hostBefore = await page.locator('.browser-page-host').boundingBox();
      const border = await line.boundingBox();
      assert.equal(border.y + border.height, hostBefore.y);
      await page.evaluate(() => window.loadingTest.emit('sia://browser-event', { tabId: 'test', kind: 'load', loading: false, url: 'https://loading.example/' }));
      await line.waitFor({ state: 'detached' });
      assert.deepEqual(await page.locator('.browser-page-host').boundingBox(), hostBefore, '加载结束不能改变网页尺寸或位置');
      await page.close();
    }
    console.log('PASS 加载流光：网页上边框、原生坐标避让、侧栏展开/收缩、明暗主题、窄窗口、收藏栏及加载结束无跳动。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
