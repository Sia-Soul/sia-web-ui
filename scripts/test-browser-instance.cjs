/** 验证启动积压与连续外部打开；只使用虚构会话，不修改真实浏览数据。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const state = window.instanceTest = { pending: [{ id: 1, url: 'https://example.com/startup' }], calls: [], listeners: {}, restored: false };
      window.__TAURI__ = {
        event: { listen: async (name, callback) => { state.listeners[name] = callback; return () => { delete state.listeners[name]; }; } },
        core: { invoke: async (command, args) => {
          state.calls.push({ command, args });
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') {
            await new Promise(resolve => setTimeout(resolve, 350));
            state.restored = true;
            return { version: 3, activeId: 'saved', groups: [], tabs: [{ id: 'saved', title: '保留的设置', url: 'sia://settings', groupId: 'group-root' }] };
          }
          if (command === 'pending_browser_opens') {
            if (!state.restored) throw new Error('会话恢复前不能消费请求');
            return state.pending.slice();
          }
          if (command === 'acknowledge_browser_opens') {
            // 确认过程中再到达一条请求，验证通知不会因正在读取而丢失。
            if (args.ids.includes(2) && !state.pending.some(request => request.id === 3)) {
              state.pending.push({ id: 3, url: 'https://example.com/repeated' });
              state.listeners['sia://external-open-pending']?.({});
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            state.pending = state.pending.filter(request => !args.ids.includes(request.id));
          }
        } },
      };
    });
    await page.goto('http://127.0.0.1:1440/');
    await page.waitForFunction(() => window.instanceTest.calls.some(call => call.command === 'save_browser_state' && call.args.state.tabs.length === 2));
    await page.evaluate(() => {
      window.instanceTest.pending.push({ id: 2, url: 'https://example.com/repeated' });
      window.instanceTest.listeners['sia://external-open-pending']({});
      window.instanceTest.listeners['sia://external-open-pending']({});
    });
    await page.waitForFunction(() => window.instanceTest.calls.some(call => call.command === 'save_browser_state' && call.args.state.tabs.length === 4));
    const saved = await page.evaluate(() => window.instanceTest.calls.filter(call => call.command === 'save_browser_state').at(-1).args.state);
    assert.equal(saved.tabs.filter(tab => tab.url === 'https://example.com/repeated').length, 2);
    assert.ok(saved.tabs.some(tab => tab.id === 'saved'));
    assert.ok(saved.tabs.every(tab => tab.groupId === 'group-root'));
    await page.waitForFunction(() => window.instanceTest.pending.length === 0);
    console.log('PASS 会话恢复前积压、重复通知去重、相同网址分别打开、读取期间新请求及原有标签保留');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
