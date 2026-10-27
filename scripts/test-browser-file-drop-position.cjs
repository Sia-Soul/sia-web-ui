/** 虚构 HTML 文件拖入真实 Tree，验证高亮/插入线与传给主窗口的位置一致。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 820 } });
    page.on('pageerror', error => console.error(error.message));
    const groups = [{ id: 'a', name: '环境', color: '#5548f6', smallGroups: [{ id: 's', name: '目标' }, { id: 'empty', name: '空分组' }] }];
    const tabs = ['one', 'two'].map(id => ({ id, title: id, url: '', groupId: 'a', smallGroupId: 's' }));
    await page.addInitScript(({ groups, tabs }) => {
      window.fileDrop = { messages: [], handlers: {} };
      window.chrome.webview = { postMessageWithAdditionalObjects: (text, files) => window.fileDrop.messages.push({ message: JSON.parse(text), files: files.map(file => file.name) }) };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.fileDrop.handlers[name] = handler; return () => {}; } }, core: { invoke: async name => {
        if (name === 'get_floating_tab_panel_state') return { groups, tabs, activeId: 'one', panelExpanded: true, panelPinned: true, panelWidth: 400, collapsedGroupIds: [], collapsedSmallGroupIds: [] };
      } } };
    }, { groups, tabs });
    const base = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1440/';
    await page.goto(new URL('tab-panel.html', base).href);
    const row = page.locator('[data-browser-tab-id="two"]');
    await row.waitFor();
    const transfer = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(['test'], '测试.html', { type: 'text/html' })); return data; });
    const bounds = await row.boundingBox();
    await row.dispatchEvent('dragover', { dataTransfer: transfer, clientX: bounds.x + 10, clientY: bounds.y + 2 });
    await page.locator('[data-drop-small-group="s"][data-drop-active="true"]').waitFor({ timeout: 3000 });
    const line = row.locator('.vertical-tree-drop-line');
    await line.waitFor({ timeout: 3000 });
    assert.equal(await line.evaluate(element => getComputedStyle(element).height), '4px');
    await row.dispatchEvent('drop', { dataTransfer: transfer, clientX: bounds.x + 10, clientY: bounds.y + 2 });
    assert.deepEqual(await page.evaluate(() => window.fileDrop.messages[0]), { message: { kind: 'sia-open-dropped-file', target: { groupId: 'a', smallGroupId: 's', beforeTabId: 'two' } }, files: ['测试.html'] });
    assert.equal(await page.locator('[data-drop-active="true"]').count(), 0);
    // 空列表和根级区域同样可放置，结束时不残留提示。
    const empty = page.locator('[data-drop-small-group="empty"]');
    await empty.dispatchEvent('dragover', { dataTransfer: transfer });
    await empty.locator('.vertical-tree-drop-line').waitFor();
    await empty.dispatchEvent('drop', { dataTransfer: transfer });
    assert.equal(await page.evaluate(() => window.fileDrop.messages[1].message.target.beforeTabId), null);
    await row.dispatchEvent('dragover', { dataTransfer: transfer });
    const root = page.locator('[data-drop-group="group-root"]');
    await root.waitFor();
    await root.dispatchEvent('dragover', { dataTransfer: transfer });
    await root.locator('.vertical-tree-drop-line').waitFor();
    await root.dispatchEvent('drop', { dataTransfer: transfer });
    assert.equal(await page.evaluate(() => window.fileDrop.messages[2].message.target.groupId), 'group-root');
    // 离开侧栏和取消拖动都应清除反馈，非网页文件不能触发原生打开。
    await row.dispatchEvent('dragover', { dataTransfer: transfer });
    await row.dispatchEvent('dragleave', { dataTransfer: transfer, clientX: -10, clientY: -10 });
    assert.equal(await page.locator('[data-drop-active="true"]').count(), 0);
    await row.dispatchEvent('dragover', { dataTransfer: transfer });
    await row.dispatchEvent('dragend', { dataTransfer: transfer });
    assert.equal(await page.locator('.vertical-tree-drop-line').count(), 0);
    const unsupported = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(['test'], '测试.txt')); return data; });
    await row.dispatchEvent('dragover', { dataTransfer: unsupported });
    await row.dispatchEvent('drop', { dataTransfer: unsupported });
    assert.equal(await page.evaluate(() => window.fileDrop.messages.length), 3);
    assert.equal(await page.locator('[data-drop-active="true"]').count(), 0);
    const main = await browser.newPage();
    await main.addInitScript(({ groups, tabs }) => {
      window.positionTest = { handlers: {}, saved: null };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.positionTest.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return { version: 3, activeId: 'one', groups, tabs };
        if (name === 'save_browser_state') window.positionTest.saved = args.state;
      } } };
    }, { groups, tabs });
    await main.goto(base);
    await main.waitForFunction(() => window.positionTest.saved && window.positionTest.handlers['sia://open-dropped-url']);
    await main.evaluate(() => window.positionTest.handlers['sia://open-dropped-url']({ payload: { url: 'file:///D:/test.html', target: { groupId: 'a', smallGroupId: 's', beforeTabId: 'two' } } }));
    await main.waitForFunction(() => window.positionTest.saved.tabs.length === 3);
    const saved = await main.evaluate(() => window.positionTest.saved);
    assert.deepEqual(saved.tabs.map(tab => tab.title === 'one' || tab.title === 'two' ? tab.id : 'new'), ['one', 'new', 'two']);
    assert.equal(saved.tabs[1].smallGroupId, 's');
    console.log('PASS 文件拖入分组高亮、4px 插入线、空分组/根级投放、原生 File 桥位置和新标签实际顺序');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
