/** 在独立会话中验证快捷键和原生关闭事件，使用虚构标签，不读取用户资料。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.shortcutTest = { closed: [], listeners: {}, state: null };
      window.__TAURI__ = {
        event: { listen: async (name, handler) => {
          window.shortcutTest.listeners[name] = handler;
          return () => {};
        } },
        core: { invoke: async (command, args) => {
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return {
            version: 3, activeId: 'second', tabLayout: 'horizontal', layoutPreferenceSet: true,
            groups: [], bookmarks: [], history: [],
            tabs: ['first', 'second', 'third'].map(id => ({
              id, title: id, url: '', groupId: 'group-root', loading: false,
              hasWebview: false, sleeping: false, audible: false, muted: false,
            })),
          };
          if (command === 'close_browser_tab') window.shortcutTest.closed.push(args.tabId);
          if (command === 'save_browser_state') window.shortcutTest.state = args.state;
        } },
      };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4173/');
    const input = page.getByRole('textbox', { name: '地址和搜索栏' });
    await input.waitFor();
    await page.waitForFunction(() => window.shortcutTest.state?.activeId === 'second');
    await input.focus();
    // 自动重复以及其他修饰键组合不能误关标签。
    for (const extras of [{ repeat: true }, { shiftKey: true }, { altKey: true }]) {
      await input.dispatchEvent('keydown', { key: 'w', ctrlKey: true, ...extras });
    }
    assert.deepEqual(await page.evaluate(() => window.shortcutTest.closed), []);
    await input.press('Control+w');
    await page.waitForFunction(() => window.shortcutTest.state?.activeId === 'third');
    assert.deepEqual(await page.evaluate(() => window.shortcutTest.closed), ['second']);
    // 原生网页快捷键复用菜单事件；验证它确实进入相同的关闭流程。
    await page.evaluate(() => window.shortcutTest.listeners['sia://native-menu-action']({ payload: 'tab|third|close' }));
    await page.waitForFunction(() => window.shortcutTest.state?.activeId === 'first');
    await page.evaluate(() => window.shortcutTest.listeners['sia://native-menu-action']({ payload: 'tab|first|close' }));
    await page.waitForFunction(() => {
      const state = window.shortcutTest.state;
      return state?.tabs.length === 1 && !['first', 'second', 'third'].includes(state.activeId);
    });
    assert.deepEqual(await page.evaluate(() => window.shortcutTest.closed), ['second', 'third', 'first']);
    assert.equal(await page.evaluate(() => window.shortcutTest.state.tabs[0].url), '');
    console.log('PASS Ctrl+W 关闭当前标签、长按和修饰键保护、原生关闭事件及最后标签保留空白页');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
