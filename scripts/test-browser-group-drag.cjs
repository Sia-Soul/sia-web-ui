/** 验证树形拖动的数据规则，以及实际构建页面中展开/收缩面板的拖放接线。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
function loadTs(name) {
  const file = path.resolve(__dirname, '../apps/browser/src', name + '.ts');
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => loadTs(name.replace('./', '')), module, module.exports);
  return module.exports;
}
const { moveTreeGroup, extractTreeItem } = loadTs('tabTreeMove');
const groups = [
  { id: 'a', name: '本地', color: '#2867df', smallGroups: [{ id: 's1', name: '管理后台' }, { id: 's2', name: '品牌方端' }] },
  { id: 'b', name: '测试', color: '#a244f2', smallGroups: [{ id: 's3', name: '测试后台' }] },
  { id: 'c', name: '空分组', color: '#119d91', smallGroups: [] },
];
const tabs = [
  { id: 'one', groupId: 'a', smallGroupId: 's1', muted: true },
  { id: 'two', groupId: 'a', smallGroupId: 's1' },
  { id: 'three', groupId: 'b', smallGroupId: 's3' },
].map(tab => ({ ...tab, title: tab.id, url: '', hasWebview: false, sleeping: false, audible: false }));
const large = { kind: 'group', groupId: 'a' };
const small = { kind: 'small-group', groupId: 'a', smallGroupId: 's1' };
assert.deepEqual(moveTreeGroup(groups, tabs, large, { groupId: 'c', beforeId: null }).groups.map(g => g.id), ['b', 'c', 'a']);
let moved = moveTreeGroup(groups, tabs, small, { groupId: 'b', beforeId: 's3' });
assert.deepEqual(moved.groups[1].smallGroups.map(g => g.id), ['s1', 's3']);
assert.equal(moved.tabs[0].groupId, 'b');
assert.equal(moved.tabs[0].profileGroupId, 'a');
assert.equal(moved.tabs[0].muted, true);
moved = moveTreeGroup(moved.groups, moved.tabs, { ...small, groupId: 'b' }, { groupId: 'c', beforeId: null });
assert.equal(moved.tabs[0].profileGroupId, 'a', '多次跨组仍保留最初的登录数据目录');
assert.equal(moveTreeGroup(groups, tabs, small, { groupId: 'missing', beforeId: null }).groups, groups);
assert.deepEqual(extractTreeItem(groups, tabs, small).tabs.map(t => t.id), ['one', 'two']);
assert.deepEqual(extractTreeItem(groups, tabs, { kind: 'tab', tabId: 'one' }).groups[0].smallGroups.map(g => g.id), ['s1']);
assert.equal(extractTreeItem(groups, tabs, { kind: 'group', groupId: 'c' }).tabs.length, 0);

(async () => {
  const { chromium } = require(path.join(process.argv[2], 'playwright'));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_TEST_CHANNEL || 'chromium' });
  const root = process.env.BROWSER_TEST_DIST || 'D:/SiaBuild/SiaWebUI/frontend-dist/browser';
  const server = http.createServer((req, res) => {
    try {
      const file = path.join(root, req.url === '/' ? 'index.html' : req.url);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const main = await browser.newPage();
  const panel = await browser.newPage();
  let payload, saved, detached, failDetach = false;
  const calls = [];
  const dispatch = (action, value) => main.evaluate(({ action, value }) => window.handlers['sia://floating-tab-panel-action']({ payload: { action, value } }), { action, value });
  try {
    for (const page of [main, panel]) {
      await page.exposeFunction('native', async (command, args) => {
        calls.push({ command, args });
        if (command === 'current_window_label') return page === main ? 'main' : 'sia-tab-panel-window';
        if (command === 'load_browser_state') return { version: 3, activeId: 'one', groups, tabs, verticalPanelPinned: false };
        if (command === 'save_browser_state') saved = args.state;
        if (command === 'open_floating_tab_panel' || command === 'update_floating_tab_panel') payload = args.payload;
        if (command === 'get_floating_tab_panel_state') return payload;
        if (command === 'floating_tab_panel_action') await dispatch(args.action.action, args.action.value);
        if (command === 'browser_drag_outside') return [1400, 200];
        if (command === 'detach_browser_window') {
          if (failDetach) throw new Error('测试：新窗口启动失败');
          detached = args.state;
        }
        return null;
      });
      await page.addInitScript(() => {
        window.handlers = {};
        window.__TAURI__ = { core: { invoke: (command, args) => window.native(command, args) },
          event: { listen: async (name, callback) => { window.handlers[name] = callback; return () => {}; } } };
      });
    }
    await main.goto(`http://127.0.0.1:${server.address().port}/`);
    await main.waitForFunction(() => window.handlers['sia://floating-tab-panel-action']);
    const wait = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 50)); } throw new Error('等待状态超时'); };
    await wait(() => saved && payload);
    // 收缩面板：通过真实拖动标题将第一组移到最后一组之后。
    const source = main.getByRole('button', { name: '分组：本地', exact: true });
    const destination = main.locator('[data-tree-group="c"]');
    await source.dragTo(destination, { targetPosition: { x: 12, y: (await destination.boundingBox()).height - 2 } });
    await wait(() => saved.groups[2].id === 'a');
    await dispatch('toggle-panel-pin', '');
    await wait(() => payload?.groups[2]?.id === 'a' && payload.panelPinned);
    await panel.goto(`http://127.0.0.1:${server.address().port}/tab-panel.html`);
    await panel.waitForFunction(() => window.handlers['sia://floating-tab-panel-visibility']);
    await panel.evaluate(() => window.handlers['sia://floating-tab-panel-visibility']({ payload: true }));
    // 展开面板：拖动小分组进入另一大分组，所有子页签整体迁移。
    const target = panel.locator('[data-tree-group="b"] .vertical-tree-group__toggle');
    await panel.locator('.vertical-tree-small-group__toggle').filter({ hasText: '管理后台' }).dragTo(target);
    await wait(() => saved.tabs.find(t => t.id === 'one').groupId === 'b');
    assert.equal(saved.tabs.find(t => t.id === 'one').profileGroupId, 'a');
    assert.equal(saved.tabs.find(t => t.id === 'two').groupId, 'b');
    assert.equal(calls.some(call => call.command === 'close_browser_tab'), false, '组内页面不因移动重新加载');
    await main.evaluate(() => window.handlers['sia://native-menu-action']({ payload: 'tab|one|duplicate' }));
    await wait(() => saved.tabs.length === 4);
    const copy = saved.tabs.find(tab => !tabs.some(original => original.id === tab.id));
    assert.equal(copy.profileGroupId, 'a', '复制页签必须继承移动后的小分组数据空间');
    await dispatch('close', copy.id);
    await wait(() => saved.tabs.length === 3);
    // IPC 接收真实宿主落点后拆组；失败必须保持源树完整。
    const value = JSON.stringify({ item: { ...small, groupId: 'b' }, position: [1400, 200] });
    failDetach = true;
    await dispatch('detach', value);
    await new Promise(r => setTimeout(r, 600));
    assert.equal(saved.tabs.length, 3);
    failDetach = false;
    const dragTitle = panel.locator('.vertical-tree-small-group__toggle').filter({ hasText: '管理后台' });
    const transfer = await panel.evaluateHandle(() => new DataTransfer());
    const outsideChecks = calls.filter(call => call.command === 'browser_drag_outside').length;
    await dragTitle.dispatchEvent('dragstart', { dataTransfer: transfer });
    await panel.keyboard.press('Escape');
    await dragTitle.dispatchEvent('dragend', { dataTransfer: transfer });
    await new Promise(r => setTimeout(r, 100));
    assert.equal(calls.filter(call => call.command === 'browser_drag_outside').length, outsideChecks, 'Escape 取消不得触发拆窗');
    await dragTitle.dispatchEvent('dragstart', { dataTransfer: transfer });
    await dragTitle.dispatchEvent('dragend', { dataTransfer: transfer });
    await wait(() => saved.tabs.length === 1);
    assert.deepEqual(detached.tabs.map(t => t.id), ['one', 'two']);
    assert.equal(detached.tabs[0].muted, true);
    assert.equal(detached.groups[0].smallGroups[0].profileGroupId, 'a');
    assert.deepEqual(saved.tabs.map(t => t.id), ['three']);
    assert.equal(saved.activeId, 'three');
    assert.equal(calls.some(call => call.command === 'close_browser_tab' && ['one', 'two'].includes(call.args.tabId)), false, '拆窗不能销毁已迁移的网页实例');
    assert.ok(!saved.groups.find(g => g.id === 'b').smallGroups.some(g => g.id === 's1'));
    console.log('PASS 分组任意排序、跨组保留数据空间、展开/收缩真实拖动、拆组失败保留、成功后移除并选择相邻页签');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
