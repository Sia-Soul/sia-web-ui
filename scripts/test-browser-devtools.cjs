/** 使用虚构原生桥验证停靠布局与快捷键，不读取用户页面或调试数据。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.dockTest = { calls: [], handlers: {}, sessions: [], fallback: false, nativeBounds: {}, switched: '' };
      window.__TAURI__ = { event: { listen: async (name, handler) => {
        window.dockTest.handlers[name] = handler; return () => {};
      } }, core: { invoke: async (name, args) => {
        const state = window.dockTest;
        state.calls.push({ name, args });
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return { version: 3, activeId: 'one', groups: [], tabs: [
          { id: 'one', title: '测试一', url: 'https://one.example.test/', groupId: 'group-root', hasWebview: true },
          { id: 'two', title: '测试二', url: 'https://two.example.test/', groupId: 'group-root', hasWebview: true },
        ] };
        // 模拟原生激活晚于 React 布局完成，暴露旧 bounds 在切页结束时覆盖新尺寸的问题。
        if (name === 'switch_browser_tab' || name === 'open_browser_tab') {
          await new Promise(resolve => setTimeout(resolve, 100));
          state.nativeBounds[args.tabId] = args.bounds;
          state.switched = args.tabId;
          return true;
        }
        if (name === 'set_browser_bounds') {
          const targets = args.tabId ? [args.tabId] : Object.keys(state.nativeBounds);
          for (const id of targets) state.nativeBounds[id] = args.bounds;
        }
        if (name === 'layout_browser_devtools') return state.sessions;
        if (name === 'open_browser_devtools') {
          if (state.fallback) return false;
          state.sessions = [...state.sessions.filter(item => item.tabId !== args.tabId), { tabId: args.tabId, docked: true }];
          return true;
        }
        if (name === 'control_browser_devtools') state.sessions = state.sessions.filter(item => item.tabId !== args.tabId);
      } } };
    });
    await page.goto('http://127.0.0.1:1440/');
    await page.waitForFunction(() => window.dockTest.handlers['sia://native-menu-action']);
    const host = page.locator('.browser-page-host');
    const original = await host.boundingBox();
    // 记录 DOM 身份：停靠不能重新挂载设置页或清空新标签页输入。
    await page.evaluate(() => { window.originalPageHost = document.querySelector('.browser-page-host'); });
    await page.keyboard.press('F12');
    await page.locator('.browser-devtools-dock').waitFor();
    const bottom = await host.boundingBox();
    assert.ok(bottom.height < original.height * 0.8);
    assert.ok(Math.abs(bottom.width - original.width) < 2);
    await page.waitForFunction(() => window.dockTest.calls.some(call => call.name === 'layout_browser_devtools' && call.args.bounds?.height > 100));
    const handle = page.locator('.browser-devtools-workspace [role="separator"]');
    const separator = await handle.boundingBox();
    await page.mouse.move(separator.x + 10, separator.y + 3);
    await page.mouse.down();
    await page.mouse.move(separator.x + 10, separator.y - 100, { steps: 8 });
    await page.mouse.up();
    assert.ok((await host.boundingBox()).height < bottom.height - 70, '分隔条必须改变网页高度');
    // 未打开工具的 B 标签必须恢复完整高度，包括真正传给 WebView2 的尺寸。
    await page.keyboard.press('Control+Tab');
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.dockTest.switched === 'two');
    const plain = await host.boundingBox();
    assert.ok(Math.abs(plain.height - original.height) < 2, 'B 标签不应预留底部工具区域');
    const nativePlain = await page.evaluate(() => window.dockTest.nativeBounds.two);
    assert.ok(Math.abs(nativePlain.height - plain.height) < 2, 'B 原生网页不能被 A 的旧停靠高度覆盖');
    await page.keyboard.press('Control+Shift+Tab');
    await page.locator('.browser-devtools-dock').waitFor();
    await page.waitForFunction(() => window.dockTest.switched === 'one');
    const restored = await host.boundingBox();
    const nativeRestored = await page.evaluate(() => window.dockTest.nativeBounds.one);
    assert.ok(Math.abs(nativeRestored.height - restored.height) < 2, '切回 A 应恢复工具占位对应的原生网页高度');
    const backgroundBounds = await page.evaluate(() => window.dockTest.nativeBounds.two);
    await page.getByRole('button', { name: '右侧', exact: true }).click();
    const right = await host.boundingBox();
    assert.ok(right.width < original.width * 0.8 && Math.abs(right.height - original.height) < 2);
    assert.deepEqual(await page.evaluate(() => window.dockTest.nativeBounds.two), backgroundBounds, '调整 A 的停靠布局不能缩放后台 B');
    await page.keyboard.press('Control+Tab');
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.dockTest.switched === 'two');
    assert.ok(Math.abs((await host.boundingBox()).width - original.width) < 2);
    const nativeRight = await page.evaluate(() => window.dockTest.nativeBounds.two);
    assert.ok(Math.abs(nativeRight.width - original.width) < 2, 'B 原生网页不应预留右侧工具区域');
    await page.keyboard.press('Control+Shift+Tab');
    await page.locator('.browser-devtools-dock').waitFor();
    await page.getByRole('button', { name: '独立窗口', exact: true }).click();
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.keyboard.press('Control+Shift+I');
    await page.locator('.browser-devtools-dock').waitFor();
    await page.locator('.browser-devtools-dock').getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.keyboard.press('F12');
    await page.locator('.browser-devtools-dock').waitFor();
    // DevTools 自带关闭按钮也应由状态轮询回收布局。
    await page.evaluate(() => { window.dockTest.sessions = []; });
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.evaluate(() => { window.dockTest.fallback = true; });
    await page.keyboard.press('F12');
    await page.getByText('当前工具窗口保持独立显示；可以关闭后按 F12 重新尝试停靠。').waitFor();
    assert.equal(await page.locator('.browser-devtools-dock').count(), 0);
    assert.ok(await page.evaluate(() => document.querySelector('.browser-page-host') === window.originalPageHost));
    assert.deepEqual(errors, []);
    console.log('PASS 底部/右侧、拖动尺寸、标签切换、独立窗口、关闭与失败回退；网页 DOM 不重挂载');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
