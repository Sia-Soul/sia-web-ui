/** 使用独立无头浏览器验证范围选择和分组切换，不读取用户配置或操作桌面。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
const base = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const groups = [
        { id: 'dev', name: 'DEV', color: '#5548f6', smallGroups: [{ id: 'admin', name: '管理' }, { id: 'brand', name: '品牌' }] },
        { id: 'pre', name: 'PRE', color: '#a244f2', smallGroups: [] },
      ];
      const extensions = [
        { id: 'global', name: '全局扩展', scopes: null },
        { id: 'parent', name: '父组扩展', scopes: [{ groupId: 'dev' }] },
        { id: 'child', name: '子组扩展', scopes: [{ groupId: 'dev', smallGroupId: 'admin' }] },
        { id: 'none', name: '未授权扩展', scopes: [] },
      ].map(record => ({ ...record, enabled: true, pinned: true, version: '1.0', source: '测试', description: '范围回归' }));
      const callbacks = new Map();
      window.scopeTest = { calls: [], extensions, failSave: false, emit: (name, payload) => {
        for (const callback of callbacks.get(name) || []) callback({ payload });
      }};
      window.__TAURI__ = {
        event: { listen: async (name, callback) => {
          const set = callbacks.get(name) || new Set(); set.add(callback); callbacks.set(name, set);
          return () => set.delete(callback);
        } },
        core: { invoke: async (command, args) => {
          window.scopeTest.calls.push({ command, args });
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return {
            version: 3, activeId: 'settings', groups,
            tabs: [{ id: 'settings', title: '西娅设置', url: 'sia://settings', groupId: 'dev', hasWebview: false, sleeping: false, loading: false, muted: false, audible: false }],
          };
          if (command === 'get_browser_menu_state') return { kind: 'extensions', darkMode: false, items: [], extensions: structuredClone(extensions), extensionScope: { groupId: 'dev' }, heading: 'DEV' };
          if (command === 'list_browser_extensions') return structuredClone(extensions);
          if (command === 'set_browser_extension_scopes') {
            if (window.scopeTest.failSave) throw new Error('模拟保存失败');
            const record = extensions.find(item => item.id === args.id); record.scopes = args.scopes;
            return structuredClone(record);
          }
          if (command === 'set_browser_extension_pinned') {
            if (window.scopeTest.deferPin) await new Promise((_, reject) => { window.scopeTest.rejectPin = reject; });
            extensions.find(item => item.id === args.id).pinned = args.pinned;
          }
        } },
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('button', { name: '扩展程序', exact: true }).click();
    const row = page.locator('.browser-settings-extension').filter({ hasText: '全局扩展' });
    await row.getByRole('button', { name: '生效分组', exact: true }).click();
    let modal = page.getByRole('dialog');
    await modal.getByText('所有分组', { exact: true }).click();
    await modal.getByText('DEV', { exact: true }).click();
    assert.equal(await modal.getByRole('checkbox', { name: '管理', exact: true }).isDisabled(), true);
    await modal.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => window.scopeTest.extensions[0].scopes?.[0]?.groupId === 'dev');
    await row.getByRole('button', { name: '生效分组', exact: true }).click();
    modal = page.getByRole('dialog');
    await modal.getByText('DEV', { exact: true }).click();
    await modal.getByText('管理', { exact: true }).click();
    await page.evaluate(() => { window.scopeTest.failSave = true; });
    await modal.getByRole('button', { name: '保存', exact: true }).click();
    await modal.getByText('Error: 模拟保存失败').waitFor();
    assert.equal(await modal.getByRole('checkbox', { name: '管理', exact: true }).isChecked(), true);
    await page.evaluate(() => { window.scopeTest.failSave = false; });
    await modal.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => window.scopeTest.extensions[0].scopes?.[0]?.smallGroupId === 'admin');
    assert.deepEqual(await page.evaluate(() => window.scopeTest.extensions[0].scopes), [{ groupId: 'dev', smallGroupId: 'admin' }]);
    await row.getByRole('button', { name: '生效分组', exact: true }).click();
    modal = page.getByRole('dialog');
    await modal.getByText('管理', { exact: true }).click();
    await modal.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => window.scopeTest.extensions[0].scopes?.length === 0);
    assert.equal(await page.locator('.browser-pinned-extensions button').count(), 2, '父分组入口只显示全局和父组扩展，隐藏子组和空范围扩展');

    // 独立面板的异步刷新也必须过滤范围，并能在操作未完成时切换分组。
    const panel = await context.newPage();
    panel.on('pageerror', error => errors.push(error.message));
    await panel.goto(`${base}menu.html`);
    await panel.waitForFunction(() => document.querySelectorAll('.browser-extension-row').length === 2);
    await panel.evaluate(() => {
      window.scopeTest.emit('sia://extension-context-changed', { extensionScope: { groupId: 'dev', smallGroupId: 'admin' }, heading: 'DEV / 管理' });
    });
    await panel.waitForFunction(() => document.querySelectorAll('.browser-extension-row').length === 3);
    await panel.waitForFunction(() => !document.querySelector('.browser-extension-row button').disabled);
    await panel.evaluate(() => { window.scopeTest.deferPin = true; });
    await panel.locator('.browser-extension-row').first().getByRole('button').first().click();
    await panel.waitForFunction(() => typeof window.scopeTest.rejectPin === 'function');
    await panel.evaluate(() => {
      window.scopeTest.emit('sia://extension-context-changed', { extensionScope: { groupId: 'pre' }, heading: 'PRE' });
      window.scopeTest.rejectPin(new Error('旧分组请求失败'));
    });
    await panel.waitForFunction(() => document.querySelectorAll('.browser-extension-row').length === 1 && !document.querySelector('.browser-extension-row button').disabled);
    assert.equal(await panel.getByRole('alert').count(), 0, '旧分组失败不得污染新分组面板');
    assert.equal(await panel.locator('.browser-extension-name').textContent(), '全局扩展');
    assert.deepEqual(errors, []);
    console.log('PASS: 父组继承、子组独立、空范围、保存失败保留草稿、工具栏过滤、面板切组和在途请求隔离');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
