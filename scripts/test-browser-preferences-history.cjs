/** 用隔离会话验证休眠偏好持久化、单页关闭和整组恢复，不触碰用户会话文件。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      const group = { id: 'test-group', name: '回归分组', color: '#2466dd', smallGroups: [{ id: 'small', name: '子分组' }] };
      const make = (id, url, smallGroupId) => ({ id, title: id, url, groupId: 'test-group', smallGroupId });
      const initial = { version: 3, activeId: 'settings', groups: [group], tabs: [make('settings', 'sia://settings'), make('one', 'https://one.test', 'small'), make('two', 'https://two.test', 'small')] };
      window.settingsTest = { handlers: {}, panel: null, saved: null, calls: [] };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.settingsTest.handlers[name] = handler; return () => {}; } }, core: { invoke: async (command, args) => {
        window.settingsTest.calls.push({ command, args });
        if (command === 'current_window_label') return 'main';
        if (command === 'load_browser_state') return JSON.parse(sessionStorage.getItem('prefs-state') || JSON.stringify(initial));
        if (command === 'save_browser_state') { window.settingsTest.saved = args.state; sessionStorage.setItem('prefs-state', JSON.stringify(args.state)); }
        if (command === 'show_browser_panel') window.settingsTest.panel = args.payload;
      } } };
    });
    await page.goto('http://127.0.0.1:1440/');
    const time = page.getByRole('spinbutton', { name: '休眠时间', exact: true });
    await time.waitFor();
    // 分钟和小时直接以分段选项显示，初始选中小时，点击即可切换。
    const unit = page.getByRole('radiogroup', { name: '休眠时间单位' });
    assert.equal(await unit.getByRole('radio', { name: '小时', exact: true }).getAttribute('aria-checked'), 'true');
    await unit.getByRole('radio', { name: '分钟', exact: true }).click();
    await time.fill('15'); await time.press('Tab');
    await page.waitForFunction(() => window.settingsTest.saved?.tabSleep?.value === 15 && window.settingsTest.saved.tabSleep.unit === 'minutes');
    await page.reload();
    await time.waitFor();
    assert.equal(await time.inputValue(), '15');
    assert.equal(await unit.getByRole('radio', { name: '分钟', exact: true }).getAttribute('aria-checked'), 'true');
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/sleep-settings.png' });
    // 从原生菜单关闭整个小分组，保存为一条带两个子标签的会话。
    await page.waitForFunction(() => window.settingsTest.handlers['sia://native-menu-action']);
    const action = async payload => page.evaluate(payload => window.settingsTest.handlers['sia://native-menu-action']({ payload }), payload);
    await page.evaluate(() => window.settingsTest.handlers['sia://browser-overlay-action']({ payload: { action: 'confirm|delete-small-group|test-group|small' } }));
    await page.waitForFunction(() => window.settingsTest.saved?.closedEntries?.[0]?.tabs.length === 2);
    const closed = await page.evaluate(() => window.settingsTest.saved.closedEntries[0]);
    assert.equal(closed.title, '子分组');
    await page.keyboard.press('Control+h');
    await page.waitForFunction(() => window.settingsTest.panel?.kind === 'history');
    assert.equal(await page.evaluate(() => window.settingsTest.panel.closedEntries[0].children.length), 2);
    await page.reload();
    await time.waitFor();
    await page.keyboard.press('Control+Shift+t');
    await page.waitForFunction(() => window.settingsTest.saved?.tabs?.filter(tab => tab.smallGroupId === 'small').length === 2 && window.settingsTest.saved.closedEntries.length === 0);
    assert.ok(await page.evaluate(() => window.settingsTest.saved.groups[0].smallGroups.some(group => group.id === 'small')));
    // 关闭单个恢复后的活动标签，再从最近关闭恢复，不能改变访问历史集合。
    await page.keyboard.press('Control+w');
    await page.waitForFunction(() => window.settingsTest.saved?.closedEntries?.length === 1);
    const entry = await page.evaluate(() => window.settingsTest.saved.closedEntries[0]);
    assert.equal(entry.tabs.length, 1);
    await action(`panel|history|restore|${entry.id}`);
    await page.waitForFunction(() => window.settingsTest.saved?.closedEntries?.length === 0);
    // 推进虚拟时钟验证真正的休眠调度，15 分钟之前保留网页，到期才释放该后台标签。
    const idleId = await page.evaluate(() => window.settingsTest.saved.activeId);
    await page.clock.install();
    await page.evaluate(() => window.settingsTest.handlers['sia://floating-tab-panel-action']({ payload: { action: 'select', value: 'settings' } }));
    await page.waitForFunction(() => window.settingsTest.saved.activeId === 'settings');
    await page.clock.fastForward(14 * 60 * 1000);
    assert.equal(await page.evaluate(id => window.settingsTest.saved.tabs.find(tab => tab.id === id)?.hasWebview, idleId), false, '持久化会话不保存运行中的网页句柄');
    assert.equal(await page.evaluate(id => window.settingsTest.calls.some(call => call.command === 'close_browser_tab' && call.args.tabId === id), idleId), false);
    await page.clock.fastForward(61 * 1000);
    await page.waitForFunction(id => window.settingsTest.calls.some(call => call.command === 'close_browser_tab' && call.args.tabId === id), idleId);
    // 模块直接验证无效持久化值回退以及计时换算。
    assert.deepEqual(await page.evaluate(async () => {
      const prefs = await import('/src/browserPreferences.ts');
      return [prefs.tabSleepMilliseconds({ value: 15, unit: 'minutes' }), prefs.tabSleepMilliseconds({ value: 2, unit: 'hours' }), prefs.normalizeTabSleep({ value: -1, unit: 'minutes' })];
    }), [900000, 7200000, { value: 1, unit: 'hours' }]);
    console.log('PASS 休眠分钟/小时、持久化及换算、关闭组会话保存、Ctrl+Shift+T 整组恢复、单页恢复');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
