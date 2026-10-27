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
      window.dockTest = { calls: [], handlers: {}, sessions: [], fallback: false, nativeBounds: {}, switched: '', delayOpen: true, releaseOpen: null, ready: false, generations: {} };
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
          const generation = state.generations[args.tabId] || 0;
          if (state.delayOpen) await new Promise(resolve => { state.releaseOpen = resolve; });
          if (generation !== (state.generations[args.tabId] || 0)) return false;
          if (state.fallback) return false;
          state.sessions = [...state.sessions.filter(item => item.tabId !== args.tabId), { tabId: args.tabId, docked: true, ready: state.ready }];
          return true;
        }
        if (name === 'control_browser_devtools') {
          state.generations[args.tabId] = (state.generations[args.tabId] || 0) + 1;
          state.sessions = state.sessions.filter(item => item.tabId !== args.tabId);
        }
      } } };
    });
    await page.goto('http://127.0.0.1:1440/');
    await page.waitForFunction(() => window.dockTest.handlers['sia://native-menu-action']);
    const host = page.locator('.browser-page-host');
    const original = await host.boundingBox();
    // 记录 DOM 身份：停靠不能重新挂载设置页或清空新标签页输入。
    await page.evaluate(() => { window.originalPageHost = document.querySelector('.browser-page-host'); });
    await page.keyboard.press('F12');
    // 原生命令未返回时必须先占位，不能等独立工具窗已经打开后才缩小网页。
    await page.getByText('正在加载开发者工具…').waitFor({ timeout: 2000 });
    assert.ok((await host.boundingBox()).height < original.height * 0.8, '打开请求进行中就应显示停靠占位');
    await page.waitForFunction(() => typeof window.dockTest.releaseOpen === 'function');
    await page.evaluate(() => { window.dockTest.delayOpen = false; window.dockTest.releaseOpen(); });
    await page.locator('.browser-devtools-dock').waitFor();
    // 找到原生窗口不等于内容就绪，加载提示须等待 ready 状态。
    await page.waitForTimeout(500);
    assert.ok(await page.getByText('正在加载开发者工具…').isVisible());
    await page.evaluate(() => { window.dockTest.ready = true; window.dockTest.sessions.forEach(item => { item.ready = true; }); });
    await page.getByText('正在加载开发者工具…').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.browser-devtools-toolbar').count(), 0, '停靠工具不得显示额外标题工具栏');
    const bottom = await host.boundingBox();
    assert.ok(bottom.height < original.height * 0.8);
    assert.ok(Math.abs(bottom.width - original.width) < 2);
    await page.waitForFunction(() => window.dockTest.calls.some(call => call.name === 'layout_browser_devtools' && call.args.bounds?.height > 100));
    const handle = page.locator('.browser-devtools-workspace [role="separator"]');
    // 控制项迁移到分隔条的原生右键菜单，验证实际菜单键经过外壳分发后仍可操作工具。
    const control = async label => {
      await handle.click({ button: 'right' });
      const key = await page.evaluate(label => window.dockTest.calls.filter(call => call.name === 'show_browser_panel').at(-1).args.payload.items.find(item => item.label === label)?.key, label);
      assert.ok(key, `分隔条菜单应包含 ${label}`);
      await page.evaluate(key => window.dockTest.handlers['sia://native-menu-action']({ payload: key }), key);
    };
    const dockBounds = await page.locator('.browser-devtools-dock').boundingBox();
    const nativeHostBounds = await page.locator('.browser-devtools-native-host').boundingBox();
    assert.ok(Math.abs(dockBounds.y - nativeHostBounds.y) < 1 && Math.abs(dockBounds.height - nativeHostBounds.height) < 1, '原生工具必须填满面板，不预留标题高度');
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
    await control('停靠到右侧');
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
    await control('独立窗口');
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.keyboard.press('Control+Shift+I');
    await page.locator('.browser-devtools-dock').waitFor();
    await control('关闭开发者工具');
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
    // 准备期间可以关闭；晚到结果不得重新展开占位或占据其他标签的网页区域。
    await page.evaluate(() => { Object.assign(window.dockTest, { fallback: false, delayOpen: true, releaseOpen: null }); });
    await page.keyboard.press('F12');
    await page.waitForFunction(() => typeof window.dockTest.releaseOpen === 'function');
    await control('关闭开发者工具');
    await page.locator('.browser-devtools-dock').waitFor({ state: 'detached' });
    await page.evaluate(() => { window.dockTest.releaseOpen(); });
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.browser-devtools-dock').count(), 0, '已取消的准备不能重新展开');
    assert.ok(await page.evaluate(() => document.querySelector('.browser-page-host') === window.originalPageHost));
    assert.deepEqual(errors, []);
    console.log('PASS 先占位、内容就绪才结束加载、准备中取消、无标题布局、分隔条右键、底部/右侧、标签切换、关闭与失败回退；网页 DOM 不重挂载');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
