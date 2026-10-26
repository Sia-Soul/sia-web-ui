/** 使用虚构浏览器配置验证导入、目录选择、失败反馈与保存，绝不读取用户实际收藏。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
    await page.addInitScript(() => {
      window.testImport = { calls: [], handlers: {}, fail: false };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.testImport.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        window.testImport.calls.push({ name, args });
        if (name === 'current_window_label') return 'browser-overlay';
        if (name === 'get_browser_overlay_state') return { kind: 'bookmark-import', darkMode: false, folders: [{ id: 'work', title: '工作' }, { id: 'dev', title: '开发', parentId: 'work' }] };
        if (name === 'list_bookmark_sources') return window.testImport.empty ? [] : [{ id: 'edge-default', browser: 'Microsoft Edge', profile: '个人' }, { id: 'chrome-work', browser: 'Google Chrome', profile: '公司' }];
        if (name === 'read_browser_bookmarks') {
          if (window.testImport.fail) throw new Error('来源文件读取失败');
          return [{ title: '收藏夹栏', url: null, children: [{ title: '中文站点', url: 'https://example.com/中文', children: [] }] }];
        }
      } } };
    });
    await page.goto('http://127.0.0.1:1440/?browser-overlay');
    await page.getByRole('combobox', { name: '来源浏览器', exact: true }).click();
    await page.getByText('Google Chrome · 公司', { exact: true }).click();
    await page.getByRole('combobox', { name: '放入位置', exact: true }).click();
    await page.getByText('工作 / 开发', { exact: true }).click();
    await page.getByRole('textbox', { name: '文件夹名称' }).fill('来自 Chrome');
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/bookmark-import.png' });
    await page.evaluate(() => { window.testImport.fail = true; });
    await page.getByRole('button', { name: '导入', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '来源文件读取失败' }).waitFor();
    assert.equal(await page.evaluate(() => window.testImport.calls.some(call => call.name === 'browser_overlay_action')), false);
    await page.evaluate(() => { window.testImport.fail = false; });
    await page.getByRole('button', { name: '导入', exact: true }).click();
    await page.waitForFunction(() => window.testImport.calls.some(call => call.name === 'browser_overlay_action'));
    const result = await page.evaluate(() => JSON.parse(window.testImport.calls.find(call => call.name === 'browser_overlay_action').args.action.value));
    assert.equal(result.parentId, 'dev');
    assert.equal(result.folderName, '来自 Chrome');
    assert.equal(result.nodes[0].children[0].title, '中文站点');
    assert.equal(await page.evaluate(() => window.testImport.calls.find(call => call.name === 'read_browser_bookmarks').args.sourceId), 'chrome-work');
    await page.evaluate(() => {
      window.testImport.calls = [];
      window.testImport.handlers['sia://browser-overlay-state']({ payload: { kind: 'bookmark-import', darkMode: false, folders: [], folderOnly: true } });
    });
    await page.getByRole('textbox', { name: '文件夹名称' }).fill('新建目录');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.waitForFunction(() => window.testImport.calls.some(call => call.name === 'browser_overlay_action'));
    assert.equal(await page.evaluate(() => JSON.parse(window.testImport.calls.find(call => call.name === 'browser_overlay_action').args.action.value).folderName), '新建目录');
    await page.evaluate(() => {
      window.testImport.empty = true;
      window.testImport.handlers['sia://browser-overlay-state']({ payload: { kind: 'bookmark-import', darkMode: true, folders: [] } });
    });
    await page.getByRole('alert').filter({ hasText: '未检测到可导入' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '导入', exact: true }).isDisabled(), true);
    const main = await browser.newPage();
    await main.addInitScript(() => {
      window.testMain = { calls: [], handlers: {}, state: { version: 3, activeId: 'base', tabs: [{ id: 'base', title: '新标签页', url: '', groupId: 'group-root' }], groups: [], bookmarks: [{ title: '原收藏', url: 'https://original.test' }], bookmarkFolders: [{ id: 'work', title: '工作' }, { id: 'dev', title: '开发', parentId: 'work' }] } };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.testMain.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        window.testMain.calls.push({ name, args });
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return window.testMain.state;
      } } };
    });
    await main.goto('http://127.0.0.1:1440/');
    await main.waitForFunction(() => window.testMain.handlers['sia://browser-overlay-action']);
    await main.evaluate(result => window.testMain.handlers['sia://browser-overlay-action']({ payload: { action: 'bookmarks-import', value: JSON.stringify(result) } }), result);
    await main.waitForFunction(() => window.testMain.calls.some(call => call.name === 'save_browser_state' && call.args.state.bookmarks.length === 2));
    const saved = await main.evaluate(() => window.testMain.calls.filter(call => call.name === 'save_browser_state').at(-1).args.state);
    assert.equal(saved.bookmarks[0].title, '原收藏');
    const wrapper = saved.bookmarkFolders.find(folder => folder.title === '来自 Chrome');
    const sourceRoot = saved.bookmarkFolders.find(folder => folder.title === '收藏夹栏');
    assert.equal(wrapper.parentId, 'dev');
    assert.equal(sourceRoot.parentId, wrapper.id);
    assert.equal(saved.bookmarks[1].parentId, sourceRoot.id);
    // 读取保存的状态再打开收藏夹，模拟重启恢复及原生快捷键的面板入口。
    await main.addInitScript(state => { window.testMain.state = state; }, saved);
    await main.reload();
    await main.waitForFunction(() => window.testMain.handlers['sia://native-menu-action']);
    await main.evaluate(() => window.testMain.handlers['sia://native-menu-action']({ payload: 'shortcut|bookmarks|base' }));
    await main.waitForFunction(() => window.testMain.calls.some(call => call.name === 'show_browser_panel' && call.args.payload.kind === 'bookmarks'));
    const payload = await main.evaluate(() => window.testMain.calls.find(call => call.name === 'show_browser_panel' && call.args.payload.kind === 'bookmarks').args.payload);
    assert.ok(payload.entries.some(entry => entry.title === '中文站点'));
    const menu = await browser.newPage();
    await menu.addInitScript(payload => { window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async name => name === 'get_browser_menu_state' ? payload : undefined } }; }, payload);
    await menu.goto('http://127.0.0.1:1440/menu.html');
    for (const title of ['工作', '开发', '来自 Chrome', '收藏夹栏']) await menu.getByRole('button', { name: title, exact: true }).click();
    await menu.getByRole('button', { name: '中文站点', exact: true }).waitFor();
    console.log('PASS 浏览器/配置选择、嵌套目标、新建目录、读取失败重试、原收藏保留、持久化及目录展开');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
