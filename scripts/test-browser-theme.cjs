/** 在系统深色的无头浏览器中验证外壳主题与原生主题命令同步，不操作用户桌面。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ colorScheme: 'dark' });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const callbacks = new Map();
      window.themeTest = { calls: [], active: true, setActive: (active) => {
        window.themeTest.active = active;
        for (const callback of callbacks.get(active ? 'tauri://focus' : 'tauri://blur') || []) callback({ payload: null });
      }, hoverEdges: edges => {
        for (const callback of callbacks.get('sia://window-resize-edges') || []) callback({ payload: edges });
      }, toggle: () => {
        for (const callback of callbacks.get('sia://native-menu-action') || []) callback({ payload: 'more:theme' });
      } };
      window.__TAURI__ = {
        event: { listen: async (name, callback) => {
          const set = callbacks.get(name) || new Set(); set.add(callback); callbacks.set(name, set);
          return () => set.delete(callback);
        } },
        core: { invoke: async (command, args) => {
          window.themeTest.calls.push({ command, args });
          if (command === 'current_window_label') return 'main';
          if (command === 'is_browser_window_active') return window.themeTest.active;
          if (command === 'list_browser_extensions') return [];
          if (command === 'load_browser_state') return null;
        } },
      };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.themeTest.calls.some(call => call.command === 'set_browser_theme' && call.args.darkMode === false));
    assert.equal(await page.locator('html').getAttribute('data-sia-theme'), 'light');
    // 验证实际绘制颜色和外壳失焦场景，避免点击原生网页后活动边框错误消失。
    const border = () => page.locator('.browser-shell').evaluate(element => getComputedStyle(element).borderTopColor);
    await page.waitForFunction(() => document.querySelector('.browser-shell')?.getAttribute('data-window-active') === 'true');
    assert.equal(await border(), 'rgb(156, 163, 175)');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('.browser-shell').getAttribute('data-window-active'), 'true');
    await page.evaluate(() => window.themeTest.toggle());
    await page.waitForFunction(() => window.themeTest.calls.filter(call => call.command === 'set_browser_theme').at(-1)?.args.darkMode === true);
    assert.equal(await page.locator('html').getAttribute('data-sia-theme'), 'dark');
    assert.equal(await border(), 'rgb(64, 150, 255)');
    // 拖动贴靠或调整窗口尺寸后，重新呈现 Tree 时必须携带当前主题，不能使用初次挂载的快照。
    await page.waitForFunction(() => window.themeTest.calls.some(call => call.command === 'open_floating_tab_panel'));
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    assert.equal(await page.evaluate(() => window.themeTest.calls.filter(call => call.command === 'open_floating_tab_panel').at(-1).args.payload.darkMode), true,
      '窗口几何变化后 Tree 必须保持深色主题');
    // 独立 Tree 页面实际消费主窗口的重新布局快照，验证最终主题而不只检查命令参数。
    const tree = await browser.newPage();
    await tree.addInitScript(payload => {
      window.treeThemeState = payload;
      window.__TAURI__ = {
        event: { listen: async () => () => {} },
        core: { invoke: async command => {
          if (command === 'current_window_label') return 'browser-tab-panel';
          if (command === 'get_floating_tab_panel_state') return window.treeThemeState;
        } },
      };
    }, await page.evaluate(() => window.themeTest.calls.filter(call => call.command === 'open_floating_tab_panel').at(-1).args.payload));
    await tree.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/');
    await tree.waitForFunction(() => document.documentElement.dataset.siaTheme === 'dark');
    // 主外框为所有原生子视图预留 4px；悬停强调线不能改变网页可用尺寸。
    const beforeHover = await page.locator('.browser-page-host').boundingBox();
    const viewport = page.viewportSize();
    assert.ok(beforeHover.x >= 4 && beforeHover.y >= 4);
    assert.ok(beforeHover.x + beforeHover.width <= viewport.width - 4);
    assert.ok(beforeHover.y + beforeHover.height <= viewport.height - 4);
    await page.waitForFunction(() => window.themeTest.calls.some(call => call.command === 'open_floating_tab_panel'));
    const nativeBounds = await page.evaluate(() => ({
      page: window.themeTest.calls.filter(call => call.command === 'set_browser_bounds').at(-1)?.args.bounds,
      tree: window.themeTest.calls.filter(call => call.command === 'open_floating_tab_panel').at(-1)?.args.bounds,
    }));
    for (const rect of [nativeBounds.page, nativeBounds.tree]) {
      assert.ok(rect.x >= 4 && rect.y >= 4);
      assert.ok(rect.x + rect.width <= viewport.width - 4 && rect.y + rect.height <= viewport.height - 4);
    }
    await page.evaluate(() => window.themeTest.hoverEdges('left bottom'));
    await page.waitForFunction(() => document.querySelector('.browser-shell').getAttribute('data-resize-edges') === 'left bottom');
    const highlight = await page.locator('.browser-shell').evaluate(element => {
      const styles = getComputedStyle(element, '::after');
      return { left: styles.borderLeftColor, bottom: styles.borderBottomColor, right: styles.borderRightColor, width: styles.borderLeftWidth };
    });
    assert.deepEqual(highlight, { left: 'rgb(250, 140, 22)', bottom: 'rgb(250, 140, 22)', right: 'rgba(0, 0, 0, 0)', width: '3px' });
    assert.deepEqual(await page.locator('.browser-page-host').boundingBox(), beforeHover);
    await page.evaluate(() => window.themeTest.hoverEdges(''));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.browser-shell'), '::after').borderLeftColor === 'rgba(0, 0, 0, 0)');
    await page.evaluate(() => window.themeTest.setActive(false));
    await page.waitForFunction(() => document.querySelector('.browser-shell')?.getAttribute('data-window-active') === 'false');
    assert.notEqual(await border(), 'rgb(64, 150, 255)');
    await page.evaluate(() => window.themeTest.setActive(true));
    await page.waitForFunction(() => document.querySelector('.browser-shell')?.getAttribute('data-window-active') === 'true');
    assert.equal(await border(), 'rgb(64, 150, 255)');
    await page.evaluate(() => window.themeTest.toggle());
    await page.waitForFunction(() => window.themeTest.calls.filter(call => call.command === 'set_browser_theme').at(-1)?.args.darkMode === false);
    assert.equal(await page.locator('html').getAttribute('data-sia-theme'), 'light');
    assert.equal(await border(), 'rgb(156, 163, 175)');
    // 返回浅色后再次调整实际视口；验证两个方向都使用最新状态。
    const opensBeforeResize = await page.evaluate(() => window.themeTest.calls.filter(call => call.command === 'open_floating_tab_panel').length);
    await page.setViewportSize({ width: 1320, height: 760 });
    await page.waitForFunction(count => window.themeTest.calls.filter(call => call.command === 'open_floating_tab_panel').length > count, opensBeforeResize);
    const lightPayload = await page.evaluate(() => window.themeTest.calls.filter(call => call.command === 'open_floating_tab_panel').at(-1).args.payload);
    assert.equal(lightPayload.darkMode, false);
    await tree.evaluate(payload => { window.treeThemeState = payload; }, lightPayload);
    await tree.waitForFunction(() => document.documentElement.dataset.siaTheme === 'light');
    assert.deepEqual(errors, []);
    // 普通网页预览渲染同一个 Sia Tree，验证拖动线的实际悬停颜色与移开复原。
    const preview = await browser.newPage();
    await preview.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const handle = preview.locator('.vertical-tab-tree__resize-handle');
    await handle.hover();
    assert.deepEqual(await handle.evaluate(element => {
      const style = getComputedStyle(element, '::before');
      return [style.width, style.backgroundColor];
    }), ['3px', 'rgb(250, 140, 22)']);
    await preview.mouse.move(800, 200);
    assert.equal(await handle.evaluate(element => getComputedStyle(element, '::before').backgroundColor), 'rgba(0, 0, 0, 0)');
    console.log('PASS: 窗口几何变化后独立 Tree 保持当前主题、活动边框同步、四周保留 4px、橙色强调线不改变布局');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
