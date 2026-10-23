/** 验证原生图标事件能更新标签树，不依赖用户站点、登录状态或桌面。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.route('https://favicon.invalid/**', route => route.fulfill({ status: 404, body: '' }));
    await page.addInitScript(() => {
      const callbacks = new Map();
      window.faviconTest = { emit: payload => {
        for (const callback of callbacks.get('sia://browser-event') || []) callback({ payload });
      } };
      window.__TAURI__ = {
        event: { listen: async (name, callback) => {
          const set = callbacks.get(name) || new Set(); set.add(callback); callbacks.set(name, set);
          return () => set.delete(callback);
        } },
        core: { invoke: async command => {
          if (command === 'current_window_label') return 'main';
          if (command === 'list_browser_extensions') return [];
          if (command === 'load_browser_state') return {
            version: 3, activeId: 'icon-test', verticalPanelPinned: false, groups: [{ id: 'test-group', name: '图标测试', color: '#4096ff', smallGroups: [] }],
            tabs: [{ id: 'icon-test', title: '图标测试网页', url: 'https://favicon.invalid/app', groupId: 'test-group', loading: false, hasWebview: false, sleeping: false, audible: false, muted: false }],
          };
        } },
      };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('[data-browser-tab-id=icon-test]').first().waitFor();
    const icons = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
      const context = canvas.getContext('2d');
      return ['red', 'blue'].map(color => { context.fillStyle = color; context.fillRect(0, 0, 16, 16); return canvas.toDataURL(); });
    });
    const emit = payload => page.evaluate(payload => window.faviconTest.emit({ tabId: 'icon-test', ...payload }), payload);
    await emit({ kind: 'load', url: 'https://favicon.invalid/app', loading: false });
    await emit({ kind: 'favicon', url: 'https://favicon.invalid/app', faviconUrl: icons[0] });
    await page.waitForFunction(src => [...document.querySelectorAll('img.browser-page-favicon')].some(img => img.src === src), icons[0], { timeout: 10000 });
    await emit({ kind: 'favicon', url: 'https://favicon.invalid/app', faviconUrl: icons[1] });
    await page.waitForFunction(src => [...document.querySelectorAll('img.browser-page-favicon')].some(img => img.src === src), icons[1]);
    await emit({ kind: 'load', url: 'https://favicon.invalid/next', loading: false });
    assert.equal(await page.locator(`img[src="${icons[1]}"]`).count(), 0);
    console.log('PASS: 非根路径站点图标更新、动态换图标、跳转后不沿用旧页面图标');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
