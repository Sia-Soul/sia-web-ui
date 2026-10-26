/** 通过浏览器界面的快捷键和原生面板事件验证页签的相邻顺序，使用独立虚构数据。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.orderTest = { listeners: {}, state: null };
      window.__TAURI__ = {
        event: { listen: async (name, handler) => {
          window.orderTest.listeners[name] = handler;
          return () => {};
        } },
        core: { invoke: async (command, args) => {
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return {
            version: 3, activeId: 'middle',
            groups: [{ id: 'group-test', name: '测试组', color: '#0088ff', smallGroups: [{ id: 'small-test', name: '子组' }] }],
            // 数组顺序故意与面板分组顺序不同，以免错误地按创建顺序选择相邻标签。
            tabs: [
              { id: 'root', groupId: 'group-root' },
              { id: 'first', groupId: 'group-test', smallGroupId: 'small-test' },
              { id: 'middle', groupId: 'group-test', smallGroupId: 'small-test' },
              { id: 'last', groupId: 'group-test', smallGroupId: 'small-test' },
              { id: 'direct', groupId: 'group-test' },
            ].map(tab => ({ ...tab, title: tab.id, url: '', loading: false, hasWebview: false, sleeping: false })),
          };
          if (command === 'save_browser_state') window.orderTest.state = args.state;
        } },
      };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4173/');
    const input = page.getByRole('textbox', { name: '地址和搜索栏' });
    const state = () => page.evaluate(() => window.orderTest.state);
    const waitActive = id => page.waitForFunction(id => window.orderTest.state?.activeId === id, id);
    const panel = (action, value) => page.evaluate(({ action, value }) => {
      window.orderTest.listeners['sia://floating-tab-panel-action']({ payload: { action, value } });
    }, { action, value });
    await waitActive('middle');
    await input.press('Control+t');
    await page.waitForFunction(() => window.orderTest.state?.tabs.length === 6);
    let saved = await state();
    const createdId = saved.activeId;
    assert.deepEqual(saved.tabs.map(tab => tab.id), ['root', 'first', 'middle', createdId, 'last', 'direct']);
    assert.equal(saved.tabs.find(tab => tab.id === createdId).smallGroupId, 'small-test');
    assert.equal(saved.tabs.find(tab => tab.id === createdId).groupId, 'group-test');
    await input.press('Control+w');
    await waitActive('middle');

    // 固定面板顶部的新建按钮与 Ctrl+T 必须有相同的同级插入行为。
    await panel('new-root-tab', '');
    await page.waitForFunction(() => window.orderTest.state?.tabs.length === 6);
    saved = await state();
    assert.equal(saved.tabs[3].id, saved.activeId);
    assert.equal(saved.tabs[3].smallGroupId, 'small-test');
    await panel('close', saved.activeId);
    await waitActive('middle');
    await panel('close', 'last');
    await page.waitForFunction(() => window.orderTest.state?.tabs.length === 4);
    assert.equal((await state()).activeId, 'middle', '关闭非当前标签不能切换页面');
    await panel('select', 'root');
    await waitActive('root');
    await panel('close', 'root');
    await waitActive('direct');
    await panel('close', 'direct');
    await waitActive('middle');
    await panel('close', 'middle');
    await waitActive('first');
    console.log('PASS 新建在当前标签下方同级插入、面板与快捷键一致、后台关闭不切换、跨组关闭按显示顺序选上一个');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
