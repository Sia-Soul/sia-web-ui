/** 使用虚构会话验证默认设置按钮与外部网址启动，不打开系统设置或更改真实默认关联。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const mode of ['direct', 'legacy', 'external']) {
      const page = await browser.newPage();
      await page.addInitScript(mode => {
        window.defaultTest = { calls: [] };
        window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
          window.defaultTest.calls.push({ command, args });
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return {
            version: 3, activeId: 'saved', groups: [], bookmarks: [], history: [],
            tabs: [{ id: 'saved', title: '西娅设置', url: 'sia://settings', groupId: 'group-root',
              loading: false, hasWebview: false, sleeping: false, muted: false, audible: false }],
          };
          if (command === 'get_browser_launch_url') return mode === 'external' ? 'https://example.com/path?q=test&x=1' : null;
          if (command === 'open_default_browser_settings') return mode !== 'legacy';
        } } };
      }, mode);
      await page.goto('http://127.0.0.1:1440/');
      if (mode === 'external') {
        await page.waitForFunction(() => window.defaultTest.calls.some(c => c.command === 'open_browser_tab'));
        const call = await page.evaluate(() => window.defaultTest.calls.find(c => c.command === 'open_browser_tab'));
        assert.equal(call.args.url, 'https://example.com/path?q=test&x=1');
        assert.equal(call.args.groupId, 'group-root');
        await page.waitForFunction(() => window.defaultTest.calls.some(c => c.command === 'save_browser_state' && c.args.state.tabs.length === 2));
        const saved = await page.evaluate(() => window.defaultTest.calls.filter(c => c.command === 'save_browser_state').at(-1).args.state);
        assert.ok(saved.tabs.some(t => t.id === 'saved'), '外部链接不能丢弃已有标签');
        assert.notEqual(saved.activeId, 'saved');
      } else {
        await page.getByRole('button', { name: '设为默认浏览器', exact: true }).click();
        await page.waitForFunction(() => window.defaultTest.calls.some(c => c.command === 'open_default_browser_settings'));
        const hint = page.getByText('当前 Windows 版本不支持直接定位', { exact: false });
        if (mode === 'legacy') await hint.waitFor();
        else assert.equal(await hint.count(), 0);
      }
      await page.close();
    }
    console.log('PASS 默认应用按钮、旧系统提示、外部链接根级新标签及会话保留');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
