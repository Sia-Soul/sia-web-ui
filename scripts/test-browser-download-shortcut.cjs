/** 下载快捷键使用虚构状态和原生桥验证，避免访问用户下载记录。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.shortcutTest = { handlers: {}, calls: [] };
      window.__TAURI__ = { event: { listen: async (name, handler) => {
        window.shortcutTest.handlers[name] = handler; return () => {};
      } }, core: { invoke: async (name, args) => {
        window.shortcutTest.calls.push({ name, args });
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return { version: 3, activeId: 'base', groups: [], tabs: [{ id: 'base', title: 'base', url: '', groupId: 'other' }] };
      } } };
    });
    await page.goto('http://127.0.0.1:1440/');
    await page.waitForFunction(() => window.shortcutTest.handlers['sia://native-menu-action']);
    const prevented = await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(event); return event.defaultPrevented;
    });
    assert.ok(prevented, 'Ctrl+J 必须阻止默认下载面板');
    await page.waitForFunction(() => window.shortcutTest.calls.some(call => call.name === 'show_browser_panel' && call.args.payload.kind === 'downloads'));
    await page.evaluate(() => {
      window.shortcutTest.calls = [];
      window.shortcutTest.handlers['sia://native-menu-action']({ payload: 'panel|downloads|show' });
    });
    await page.waitForFunction(() => window.shortcutTest.calls.some(call => call.name === 'show_browser_panel' && call.args.payload.kind === 'downloads'));
    console.log('PASS Ctrl+J 阻止默认行为，主窗口及网页原生事件打开自有下载面板');
    // 用同一张表覆盖 30 个映射，同时确认网页基础能力不被外壳吞掉。
    const mapping = await page.evaluate(async () => {
      const { browserShortcut } = await import('/src/browserShortcuts.ts');
      const { default: bindings } = await import('/src/browserShortcuts.json');
      return { matches: bindings.every(binding => browserShortcut(new KeyboardEvent('keydown', {
        key: binding.key, ctrlKey: Boolean(binding.ctrl), shiftKey: Boolean(binding.shift), altKey: Boolean(binding.alt),
      })) === binding.action), retained: ['f', 'p', '+', '-', '0', 'c', 'v', 'x', 'z'].every(key =>
        browserShortcut(new KeyboardEvent('keydown', { key, ctrlKey: true })) === undefined) };
    });
    assert.deepEqual(mapping, { matches: true, retained: true });
    for (const [key, shiftKey, kind] of [['h', false, 'history'], ['o', true, 'bookmarks']]) {
      await page.evaluate(({ key, shiftKey }) => {
        window.shortcutTest.calls = [];
        window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey, cancelable: true }));
      }, { key, shiftKey });
      await page.waitForFunction(kind => window.shortcutTest.calls.some(call => call.name === 'show_browser_panel' && call.args.payload.kind === kind), kind);
    }
    await page.evaluate(() => window.shortcutTest.handlers['sia://native-menu-action']({ payload: 'shortcut|address|base' }));
    await page.waitForFunction(() => window.shortcutTest.calls.some(call => call.name === 'browser_window_action' && call.args.action === 'focus-address'));
    // 长按只吞掉默认行为，带额外修饰键的组合保留原用途。
    const suppressed = await page.evaluate(() => {
      window.shortcutTest.calls = [];
      const repeat = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, repeat: true, cancelable: true });
      window.dispatchEvent(repeat);
      const shifted = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true, cancelable: true });
      window.dispatchEvent(shifted);
      return { repeat: repeat.defaultPrevented, shifted: shifted.defaultPrevented,
        panels: window.shortcutTest.calls.filter(call => call.name === 'show_browser_panel').length };
    });
    assert.deepEqual(suppressed, { repeat: true, shifted: false, panels: 0 });
    for (const surface of ['tab-panel', 'menu']) {
      const child = await browser.newPage();
      await child.addInitScript(surface => {
        window.childCalls = [];
        window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (name, args) => {
          window.childCalls.push({ name, args });
          if (name === 'get_floating_tab_panel_state') return { groups: [], tabs: [], activeId: '', darkMode: false,
            closedTabCount: 0, panelExpanded: true, panelPinned: true, panelWidth: 300, collapsedGroupIds: [], collapsedSmallGroupIds: [] };
          if (name === 'get_browser_menu_state') return { kind: 'history', items: [], entries: [], darkMode: false };
        } } };
      }, surface);
      await child.goto(`http://127.0.0.1:1440/${surface}.html`);
      await child.waitForFunction(() => window.childCalls.some(call => call.name.startsWith('get_')));
      // 等待组件完成原生状态读取和快捷键 Effect 安装。
      await child.waitForTimeout(100);
      const result = await child.evaluate(() => {
        const event = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, cancelable: true });
        window.dispatchEvent(event); return { prevented: event.defaultPrevented, calls: window.childCalls };
      });
      assert.ok(result.prevented, `${surface} 必须接管 Ctrl+J`);
      assert.ok(result.calls.some(call => surface === 'tab-panel'
        ? call.name === 'floating_tab_panel_action' && call.args.action.action === 'shortcut' && call.args.action.value === 'downloads'
        : call.name === 'browser_menu_action' && call.args.action.action === 'shortcut|downloads'));
      await child.close();
    }
    console.log('PASS 独立 Tree、工具面板快捷键及长按/修饰键保护');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
