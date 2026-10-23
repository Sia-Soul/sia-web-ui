/** 通过无头浏览器和虚构扩展验证紧凑面板，不启动桌面程序或访问用户数据。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
const base = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 380, height: 600 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const extensions = Array.from({ length: 12 }, (_, index) => ({
        id: `extension-${index}`, name: index === 0 ? '这是一个很长的扩展名称，用于验证窄面板省略效果' : `测试扩展 ${index}`,
        enabled: index !== 2, pinned: index === 1, optionsPage: index === 0 ? 'options.html' : undefined,
        version: '1.0', source: 'test', description: '测试扩展',
      }));
      const callbacks = new Map();
      window.panelTest = { calls: [], extensions, failPin: false, deferList: false, deferPin: false, emit: payload => {
        for (const callback of callbacks.get('sia://browser-menu-state') || []) callback({ payload });
      } };
      window.__TAURI__ = {
        event: { listen: async (name, callback) => {
          const entries = callbacks.get(name) || new Set(); entries.add(callback); callbacks.set(name, entries);
          return () => entries.delete(callback);
        } },
        core: { invoke: async (command, args) => {
          window.panelTest.calls.push({ command, args });
          // 原生桥接返回 JSON 副本，模拟层同样避免共享可变记录。
          if (command === 'get_browser_menu_state') return structuredClone({ kind: 'extensions', darkMode: false, items: [], extensions });
          if (command === 'list_browser_extensions') {
            const snapshot = structuredClone(extensions);
            if (window.panelTest.deferList) await new Promise(resolve => { window.panelTest.releaseList = resolve; });
            return snapshot;
          }
          if (command === 'set_browser_extension_pinned') {
            if (window.panelTest.deferPin) await new Promise((resolve, reject) => { window.panelTest.rejectPin = reject; });
            if (window.panelTest.failPin) throw new Error('模拟保存失败');
            extensions.find(entry => entry.id === args.id).pinned = args.pinned;
          }
          if (command === 'set_browser_extension_enabled') extensions.find(entry => entry.id === args.id).enabled = args.enabled;
          if (command === 'remove_browser_extension') extensions.splice(extensions.findIndex(entry => entry.id === args.id), 1);
        } },
      };
    });
    await page.goto(`${base}menu.html`);
    await page.getByRole('region', { name: '扩展面板' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.browser-extension-row').length === 12);
    assert.equal((await page.locator('.browser-panel').boundingBox()).width, 340);
    assert.equal(await page.locator('.browser-extension-row').first().evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.equal(await page.locator('.browser-panel__scroll').evaluate(el => el.scrollHeight > el.clientHeight), true);
    // 列表可滚动，底部管理入口固定可见，全部内部过渡为零。
    await page.getByRole('button', { name: '管理扩展', exact: true }).isVisible().then(value => assert.equal(value, true));
    assert.equal(await page.locator('.browser-panel__toolbar-button').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    const firstPin = page.locator('.browser-extension-row').first().getByRole('button').first();
    await firstPin.click();
    await page.waitForFunction(() => document.querySelector('.browser-extension-row button').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('.browser-panel').count(), 1, '固定操作不关闭面板');
    await page.evaluate(() => { window.panelTest.failPin = true; });
    await firstPin.click();
    await page.getByRole('alert').waitFor();
    assert.equal(await firstPin.getAttribute('aria-pressed'), 'true', '保存失败不改变固定状态');
    await page.evaluate(() => { window.panelTest.failPin = false; });
    await page.locator('.browser-extension-row').first().getByRole('button').last().click();
    await page.getByText('停用扩展', { exact: true }).click();
    await page.locator('.browser-extension-row').first().getByText('已停用').waitFor();
    await page.locator('.browser-extension-row').last().getByRole('button').last().click();
    const menuBox = await page.locator('.browser-extension-context-menu').boundingBox();
    assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= 380);
    assert.ok(menuBox.y >= 0 && menuBox.y + menuBox.height <= 600);
    await page.screenshot({ path: 'logs/browser-extensions-panel.png' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.browser-extension-context-menu').count(), 0);
    assert.equal(await page.locator('.browser-panel').count(), 1, 'Escape 优先关闭子菜单');
    await page.locator('.browser-extension-row').last().getByRole('button').last().click();
    await page.getByText('从浏览器中移除', { exact: true }).click();
    assert.equal(await page.evaluate(() => window.panelTest.calls.filter(call => call.command === 'remove_browser_extension').length), 0);
    await page.getByText('确认移除此扩展', { exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.browser-extension-row').length === 11);
    await page.getByRole('button', { name: '管理扩展', exact: true }).click();
    assert.equal(await page.evaluate(() => window.panelTest.calls.at(-1).args.action.action), 'panel|extensions|manage');

    // 切换面板清理子菜单、搜索和旧列表；空状态与深色主题仍可使用。
    await page.evaluate(() => window.panelTest.emit({ kind: 'bookmarks', items: [], entries: [], darkMode: true }));
    await page.locator('.browser-panel--bookmarks').waitFor();
    assert.equal(await page.locator('.browser-extension-context-menu').count(), 0);
    assert.equal(await page.locator('.browser-panel').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    // 延迟读取时禁用写操作；切面板后旧操作失败不能污染新面板。
    await page.evaluate(() => {
      window.panelTest.deferList = true;
      window.panelTest.emit({ kind: 'extensions', items: [], extensions: structuredClone(window.panelTest.extensions), darkMode: true });
    });
    await page.waitForFunction(() => typeof window.panelTest.releaseList === 'function');
    assert.equal(await firstPin.isDisabled(), true);
    await page.evaluate(() => { window.panelTest.deferList = false; window.panelTest.releaseList(); });
    await page.waitForFunction(() => !document.querySelector('.browser-extension-row button').disabled);
    await page.evaluate(() => { window.panelTest.deferPin = true; });
    await firstPin.click();
    await page.waitForFunction(() => typeof window.panelTest.rejectPin === 'function');
    await page.evaluate(() => {
      window.panelTest.emit({ kind: 'bookmarks', items: [], entries: [], darkMode: true });
      window.panelTest.rejectPin(new Error('上一个面板的延迟失败'));
    });
    await page.locator('.browser-panel--bookmarks').waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);

    const main = await browser.newPage({ viewport: { width: 1380, height: 860 } });
    await main.addInitScript(() => {
      window.panelCalls = [];
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        window.panelCalls.push({ command, args });
        if (command === 'current_window_label') return 'main';
        if (command === 'list_browser_extensions') return Array.from({ length: 20 }, (_, index) => ({ id: `pinned-${index}`, name: `固定扩展 ${index}`, enabled: true, pinned: true }));
      } } };
    });
    await main.goto(base);
    for (const [label, key, width] of [['收藏夹', 'bookmarks', 360], ['历史记录', 'history', 360], ['扩展', 'extensions', 340], ['下载', 'downloads', 360]]) {
      await main.getByRole('button', { name: label, exact: true }).click();
      const args = await main.evaluate(() => window.panelCalls.filter(call => call.command === 'show_browser_panel').at(-1).args);
      assert.equal(args.width, width);
      assert.equal(args.payload.toggleKey, key);
      assert.equal(args.payload.panelKey, key);
      assert.ok(args.payload.triggerBounds.width > 0);
    }
    await main.getByRole('button', { name: '更多', exact: true }).click();
    assert.ok(await main.evaluate(() => window.panelCalls.find(call => call.command === 'show_browser_more_menu').args.triggerBounds.width > 0));
    assert.equal(await main.locator('.browser-pinned-extensions button').count(), 4);
    await main.setViewportSize({ width: 960, height: 700 });
    assert.equal(await main.locator('.browser-pinned-extensions').isVisible(), false);
    const moreBounds = await main.getByRole('button', { name: '更多', exact: true }).boundingBox();
    assert.ok(moreBounds.x + moreBounds.width <= 960, '固定较多扩展不能挤出工具栏按钮');
    console.log('PASS: 扩展列表、固定、启停、失败保留、移除确认、窄面板布局及所有工具栏入口参数');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
