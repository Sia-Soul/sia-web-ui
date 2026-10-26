/** 长列表回归：使用虚构标签验证原生侧栏定位、紧凑布局及外部打开后的祖先展开。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const groups = [{ id: 'long', name: '长列表', color: '#6655ee', smallGroups: [{ id: 'small', name: '小分组' }] }];
const tabs = Array.from({ length: 70 }, (_, index) => ({ id: `tab-${index}`, title: `页面 ${index}`, url: '', groupId: 'long', smallGroupId: 'small' }));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const panel = await browser.newPage({ viewport: { width: 340, height: 500 } });
    await panel.addInitScript(({ groups, tabs }) => {
      window.revealPayload = { groups, tabs, activeId: 'tab-0', darkMode: false, panelExpanded: true, panelPinned: true, panelWidth: 330, collapsedGroupIds: [], collapsedSmallGroupIds: [] };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async command => {
        if (command === 'get_floating_tab_panel_state') return structuredClone(window.revealPayload);
      } } };
    }, { groups, tabs });
    await panel.goto('http://127.0.0.1:1440/tab-panel.html');
    const visible = id => panel.waitForFunction(id => {
      const container = document.querySelector('.vertical-tab-tree__scroll, .vertical-tab-tree__compact-scroll');
      const row = container?.querySelector(`[data-browser-tab-id="${id}"]`);
      if (!row) return false;
      const bounds = row.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
    }, id);
    await visible('tab-0');
    // 手动新建与外部打开共用 activeId；新节点出现在列表末尾时应完整可见。
    await panel.evaluate(() => {
      window.revealPayload.tabs.push({ id: 'new-root', title: '新标签页', url: '', groupId: 'group-root' });
      window.revealPayload.activeId = 'new-root';
    });
    await visible('new-root');
    await panel.evaluate(() => { window.revealPayload.activeId = 'tab-0'; });
    await visible('tab-0');
    // 模拟用户手动滚动后网页标题更新，不能被后台状态更新强制拉回顶部。
    const manualTop = await panel.evaluate(() => {
      const container = document.querySelector('.vertical-tab-tree__scroll');
      container.scrollTop = 700;
      window.revealPayload.tabs[0].title = '标题更新';
      return container.scrollTop;
    });
    await panel.getByRole('button', { name: '标题更新', exact: true }).waitFor({ state: 'attached' });
    assert.equal(await panel.locator('.vertical-tab-tree__scroll').evaluate(node => node.scrollTop), manualTop);
    // 节点先被折叠隐藏，收到展开状态后再滚动；不能提前认为定位完成。
    await panel.evaluate(() => { window.revealPayload.collapsedSmallGroupIds = ['small']; window.revealPayload.activeId = 'tab-69'; });
    await panel.locator('[data-browser-tab-id="tab-69"]').waitFor({ state: 'detached' });
    await panel.evaluate(() => { window.revealPayload.collapsedSmallGroupIds = []; });
    await visible('tab-69');
    await panel.evaluate(() => { window.revealPayload.panelExpanded = false; });
    await panel.locator('.vertical-tab-tree__compact-scroll').waitFor();
    await visible('tab-69');
    await panel.evaluate(() => { window.revealPayload.panelExpanded = true; });
    await panel.locator('.vertical-tab-tree__scroll').waitFor();
    await visible('tab-69');

    // 在主界面验证折叠分组内新建标签会更新展开状态，传给独立侧栏。
    const main = await browser.newPage();
    await main.addInitScript(({ groups, tabs }) => {
      window.revealMain = { listeners: {}, latest: null, pending: [] };
      window.__TAURI__ = { event: { listen: async (name, callback) => { window.revealMain.listeners[name] = callback; return () => {}; } }, core: { invoke: async (command, args) => {
        if (command === 'current_window_label') return 'main';
        if (command === 'load_browser_state') return { version: 3, groups, tabs, activeId: 'tab-0' };
        if (command === 'pending_browser_opens') return window.revealMain.pending.slice();
        if (command === 'acknowledge_browser_opens') window.revealMain.pending = [];
        if (command === 'update_floating_tab_panel' || command === 'open_floating_tab_panel') window.revealMain.latest = args;
      } } };
    }, { groups, tabs });
    await main.goto('http://127.0.0.1:1440/');
    await main.waitForFunction(() => window.revealMain.latest && window.revealMain.listeners['sia://floating-tab-panel-action']);
    const action = (action, value) => main.evaluate(({ action, value }) => window.revealMain.listeners['sia://floating-tab-panel-action']({ payload: { action, value } }), { action, value });
    await action('toggle-group', 'long');
    await action('toggle-small-group', 'small');
    await main.waitForFunction(() => {
      const payload = window.revealMain.latest.payload;
      return payload?.collapsedGroupIds.includes('long') && payload.collapsedSmallGroupIds.includes('small');
    });
    await action('new-tab', 'long|small');
    await main.waitForFunction(() => {
      const payload = window.revealMain.latest.payload;
      return payload?.tabs.length === 71 && !payload.collapsedGroupIds.includes('long') && !payload.collapsedSmallGroupIds.includes('small');
    });
    // 双击文件经单实例队列打开后，将真实主界面输出交给侧栏，验证跨窗口同步后的滚动。
    await main.evaluate(() => {
      window.revealMain.pending = [{ id: 1, url: 'file:///D:/example.html' }];
      window.revealMain.listeners['sia://external-open-pending']({});
    });
    await main.waitForFunction(() => window.revealMain.latest.payload?.tabs.length === 72);
    const externalPayload = await main.evaluate(() => window.revealMain.latest.payload);
    assert.equal(externalPayload.tabs.find(tab => tab.id === externalPayload.activeId).url, 'file:///D:/example.html');
    await panel.evaluate(payload => { window.revealPayload = payload; }, externalPayload);
    await visible(externalPayload.activeId);
    console.log('PASS 长列表新标签定位、双击文件跨窗口定位、上下切换、折叠后展开、紧凑布局及标题更新不抢滚动');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
