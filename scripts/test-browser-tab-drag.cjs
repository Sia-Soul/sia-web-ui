/** 使用隔离的虚构标签与原生桥验证拖放及数据空间切换，不接触真实浏览会话。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
const groups = [
  { id: 'a', name: '环境甲', color: '#5548f6', smallGroups: [{ id: 'a1', name: '管理后台' }, { id: 'a2', name: '品牌方端' }] },
  { id: 'b', name: '环境乙', color: '#119d91', smallGroups: [{ id: 'b1', name: '目标小分组' }] },
];
const tabs = [{ id: 'one', title: '测试页面', url: 'https://example.test/', groupId: 'a', smallGroupId: 'a1', loading: false, hasWebview: true, sleeping: false, audible: false, muted: false },
  { id: 'sleep', title: '后台页面', url: 'https://sleep.example.test/', groupId: 'a', smallGroupId: 'a1', loading: false, hasWebview: false, sleeping: true, audible: false, muted: false }];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 820 } });
    await page.addInitScript(({ groups, tabs }) => {
      const payload = { groups, tabs, activeId: 'one', darkMode: false, closedTabCount: 0, panelExpanded: true, panelPinned: true, panelWidth: 400, collapsedGroupIds: [], collapsedSmallGroupIds: [] };
      window.dragTest = { moves: [], payload };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        // 原生桥每次反序列化出新对象，模拟端也必须保持同样的引用语义。
        if (command === 'get_floating_tab_panel_state') return structuredClone(payload);
        if (command === 'floating_tab_panel_action' && args.action.action === 'move-tab') {
          const move = JSON.parse(args.action.value);
          window.dragTest.moves.push(move);
          payload.tabs = payload.tabs.map(tab => tab.id === move.tabId ? { ...tab, groupId: move.groupId, smallGroupId: move.smallGroupId } : tab);
        }
      } } };
    }, { groups, tabs });
    await page.goto('http://127.0.0.1:1440/tab-panel.html');
    const source = () => page.locator('[data-browser-tab-id="one"] .vertical-tree-tab__select');
    const target = (group, small) => page.locator(`[data-drop-group="${group}"][data-drop-small-group="${small}"]`);
    await source().dragTo(target('a', 'a2'));
    await page.waitForFunction(() => window.dragTest.moves.length === 1);
    assert.deepEqual(await page.evaluate(() => window.dragTest.moves[0]), { tabId: 'one', groupId: 'a', smallGroupId: 'a2', beforeTabId: null });
    await target('a', 'a2').locator('[data-browser-tab-id="one"]').waitFor();
    await source().dragTo(target('b', 'b1'));
    await page.waitForFunction(() => window.dragTest.moves.length === 2);
    await target('b', 'b1').locator('[data-browser-tab-id="one"]').waitFor();
    // 大分组由外层容器统一接收，标题与直属标签共用同一目标。
    await source().dragTo(page.locator('.vertical-tree-group[data-drop-group="a"] .vertical-tree-group__heading'));
    await page.waitForFunction(() => window.dragTest.moves.length === 3);
    assert.equal(await page.evaluate(() => window.dragTest.moves[2].smallGroupId), undefined);
    await page.locator('.vertical-tree-group[data-drop-group="a"] .vertical-tree-group__direct-tabs [data-browser-tab-id="one"]').waitFor();
    // 同分组投放传入排序位置；外部伪造的数据不得触发移动。
    await source().dragTo(page.locator('.vertical-tree-group[data-drop-group="a"] .vertical-tree-group__heading'));
    const external = await page.evaluateHandle(() => new DataTransfer());
    await target('b', 'b1').dispatchEvent('drop', { dataTransfer: external });
    assert.equal(await page.evaluate(() => window.dragTest.moves.length), 4);
    await page.close();

    const main = await browser.newPage();
    await main.addInitScript(({ groups, tabs }) => {
      window.moveTest = { calls: [], listeners: {} };
      window.__TAURI__ = { event: { listen: async (name, callback) => { window.moveTest.listeners[name] = callback; return () => {}; } }, core: { invoke: async (command, args) => {
        window.moveTest.calls.push({ command, args });
        if (command === 'close_browser_tab' && window.moveTest.failClose) throw new Error('模拟关闭失败');
        if (command === 'close_browser_tab' && window.moveTest.delayClose) return new Promise(resolve => { window.moveTest.finishClose = resolve; });
        if (command === 'current_window_label') return 'main';
        if (command === 'load_browser_state') return { version: 3, groups, tabs, activeId: 'one', tabLayout: 'vertical', layoutPreferenceSet: true, bookmarks: [], history: [] };
        if (command === 'save_browser_state') window.moveTest.saved = args.state;
        if (command === 'switch_browser_tab') return true;
      } } };
    }, { groups, tabs });
    await main.goto('http://127.0.0.1:1440/');
    await main.waitForFunction(() => window.moveTest.listeners['sia://floating-tab-panel-action'] && window.moveTest.saved?.tabs.some(t => t.id === 'one'));
    async function move(tabId, groupId, smallGroupId, beforeTabId) {
      await main.evaluate(target => {
        window.moveTest.calls = [];
        window.moveTest.listeners['sia://floating-tab-panel-action']({ payload: { action: 'move-tab', value: JSON.stringify(target) } });
      }, { tabId, groupId, smallGroupId, beforeTabId });
    }
    // 组内排序只更新顺序并保存，不关闭或重建原生网页。
    await move('sleep', 'a', 'a1', 'one');
    await main.waitForFunction(() => window.moveTest.saved.tabs[0].id === 'sleep');
    assert.equal(await main.evaluate(() => window.moveTest.calls.some(c => ['close_browser_tab', 'open_browser_tab'].includes(c.command))), false);
    await move('sleep', 'a', 'a1', null);
    await main.waitForFunction(() => window.moveTest.saved.tabs[0].id === 'one');
    assert.equal(await main.evaluate(() => window.moveTest.calls.some(c => ['close_browser_tab', 'open_browser_tab'].includes(c.command))), false);
    await move('one', 'b', 'b1');
    await main.waitForFunction(() => window.moveTest.calls.some(c => c.command === 'open_browser_tab' && c.args.smallGroupId === 'b1'));
    const commands = await main.evaluate(() => window.moveTest.calls.map(c => c.command));
    assert.ok(commands.indexOf('close_browser_tab') < commands.indexOf('open_browser_tab'));
    await main.waitForFunction(() => window.moveTest.saved.tabs.find(t => t.id === 'one')?.smallGroupId === 'b1');
    await move('sleep', 'b', 'b1', 'one');
    await main.waitForFunction(() => window.moveTest.saved.tabs.find(t => t.id === 'sleep')?.smallGroupId === 'b1');
    assert.equal(await main.evaluate(() => window.moveTest.calls.some(c => c.command === 'open_browser_tab')), false);
    assert.equal(await main.evaluate(() => window.moveTest.saved.tabs.find(t => t.id === 'sleep').sleeping), true);
    assert.deepEqual(await main.evaluate(() => window.moveTest.saved.tabs.filter(t => t.groupId === 'b').map(t => t.id)), ['sleep', 'one']);
    await move('one', 'b', 'missing');
    assert.equal(await main.evaluate(() => window.moveTest.calls.some(c => c.command === 'close_browser_tab')), false);
    // 旧 WebView 无法关闭时恢复原归属，不把原 Cookie 的实例留在新分组名下。
    await main.evaluate(() => { window.moveTest.failClose = true; });
    await move('one', 'a', 'a1');
    await main.getByText('模拟关闭失败', { exact: true }).waitFor();
    await main.waitForFunction(() => window.moveTest.saved.tabs.find(t => t.id === 'one')?.smallGroupId === 'b1');
    assert.equal(await main.evaluate(() => window.moveTest.calls.some(c => c.command === 'open_browser_tab')), false);
    assert.deepEqual(await main.evaluate(() => window.moveTest.saved.tabs.filter(t => t.groupId === 'b').map(t => t.id)), ['sleep', 'one']);
    await main.evaluate(() => { window.moveTest.failClose = false; window.moveTest.delayClose = true; });
    await move('one', 'a', 'a1');
    await main.waitForFunction(() => typeof window.moveTest.finishClose === 'function');
    await main.evaluate(() => {
      window.moveTest.listeners['sia://floating-tab-panel-action']({ payload: { action: 'select', value: 'sleep' } });
      window.moveTest.finishClose();
    });
    await main.waitForFunction(() => {
      const tab = window.moveTest.saved.tabs.find(t => t.id === 'one');
      return tab?.smallGroupId === 'a1' && tab.sleeping && !tab.loading;
    });
    assert.equal(await main.evaluate(() => window.moveTest.calls.some(c => c.command === 'open_browser_tab' && c.args.tabId === 'one')), false);
    await main.close();
    console.log('PASS: 树拖放、同组排序不重建网页、跨组按位置插入、外部拖放拒绝、原生先关闭再切换数据空间、失败回退、后台休眠和保存。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
