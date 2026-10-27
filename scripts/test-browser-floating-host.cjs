/** 仅用虚构桥接和无头浏览器验证统一浮层协议、异步切换与真实子层定位，不启动桌面程序。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = (process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1457').replace(/\/$/, '');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const handlers = new Map();
      const extension = { id: 'one', name: '测试扩展', enabled: true, version: '1', source: 'test' };
      window.hostTest = { calls: [], handlers, extension, emit: (name, payload) => {
        for (const handler of handlers.get(name) || []) handler({ payload });
      } };
      window.__TAURI__ = {
        // 每个订阅独立销毁，兼容 StrictMode 的重复挂载；旧清理不能移除新订阅。
        event: { listen: async (name, handler) => {
          const entries = handlers.get(name) || new Set(); entries.add(handler); handlers.set(name, entries);
          return () => entries.delete(handler);
        } },
        core: { invoke: async (command, args) => {
          window.hostTest.calls.push({ command, args });
          if (command === 'get_browser_menu_state') return new Promise(resolve => { window.hostTest.resolveSnapshot = resolve; });
          if (command === 'list_browser_extensions') return [structuredClone(extension)];
        } },
      };
    });
    await page.goto(`${base}/menu.html`);
    await page.waitForFunction(() => window.hostTest.resolveSnapshot);
    let revision = 0;
    const open = async (kind, extra = {}, width = 340, left = 20) => {
      const payload = { kind: kind === 'more' ? 'menu' : kind, panelKey: kind, items: [], entries: [], hitRegionRevision: ++revision,
        menuLayout: { left, top: 20, width, height: 640 }, ...extra };
      await page.evaluate(payload => window.hostTest.emit('sia://browser-menu-state', payload), payload);
      await page.waitForFunction(revision => window.hostTest.calls.some(call => call.command === 'update_browser_menu_regions' && call.args.revision === revision), revision).catch(async error => {
        // 超时输出限于虚构测试数据，便于区分桥接协议与渲染失败。
        console.error({ kind, revision, errors, state: await page.evaluate(() => ({ calls: window.hostTest.calls, text: document.body.innerText })) });
        throw error;
      });
      return payload;
    };
    const root = page.locator('[data-browser-floating-surface="root"]');
    const submenu = page.locator('[data-browser-floating-surface="submenu"]');
    const latest = () => page.evaluate(() => window.hostTest.calls.filter(call => call.command === 'update_browser_menu_regions').at(-1).args);

    // 六类面板在同一宿主中切换，根宽不因子层画布增大而撑满窗口。
    for (const kind of ['bookmarks', 'downloads', 'history', 'menu', 'more', 'extensions']) {
      const width = ['menu', 'more'].includes(kind) ? 240 : 340;
      await open(kind, { darkMode: true, items: kind === 'menu' || kind === 'more' ? [{ key: 'test', label: '菜单操作' }] : [] }, width);
      assert.equal(await root.count(), 1);
      const box = await root.boundingBox();
      assert.equal(box.width, width);
      assert.equal(box.x, 20);
      assert.equal(box.y, 20);
      assert.ok(box.height <= 640);
      assert.equal((await latest()).regions.length, 1);
      assert.notEqual(await root.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
    }
    await page.evaluate(() => window.hostTest.resolveSnapshot({ kind: 'bookmarks', items: [], hitRegionRevision: 1 }));
    await page.waitForTimeout(60);
    assert.equal(await page.locator('.browser-floating-host').getAttribute('data-panel-kind'), 'extensions', '迟到首屏快照不得覆盖新面板');

    // 扩展子层在父面板外侧展开，有空间时保留间距，并真实参与原生区域报告。
    await page.locator('.browser-extension-row').getByRole('button', { name: '测试扩展 更多操作' }).click();
    await submenu.waitFor();
    let a = await root.boundingBox(), b = await submenu.boundingBox();
    assert.ok(b.x - (a.x + a.width) >= 8, '右侧子层不覆盖父面板');
    await page.waitForFunction(() => window.hostTest.calls.filter(call => call.command === 'update_browser_menu_regions').at(-1).args.regions.length === 2);
    await page.keyboard.press('Escape');
    assert.equal(await submenu.count(), 0);
    assert.equal(await root.count(), 1);
    await open('extensions', {}, 340, 440);
    await page.locator('.browser-extension-row').getByRole('button', { name: '测试扩展 更多操作' }).click();
    b = await submenu.boundingBox(); a = await root.boundingBox();
    assert.ok(a.x - (b.x + b.width) >= 8, '右边空间不足时子层翻到左侧');

    // 下载搜索和进度更新保留现有交互；点击父层直接关闭子层且接续父层动作。
    const downloadPayload = await open('downloads', { entries: [{ id: 'file', title: 'fixture.zip', fileName: 'fixture.zip', state: 'started', receivedBytes: 10, totalBytes: 100 }] });
    await page.getByRole('button', { name: '搜索下载', exact: true }).click();
    await page.getByPlaceholder('搜索下载').fill('fixture');
    await page.evaluate(payload => window.hostTest.emit('sia://browser-menu-state', payload), downloadPayload);
    assert.equal(await page.getByPlaceholder('搜索下载').inputValue(), 'fixture', '同批次重复通知不能重置搜索');
    await page.evaluate(() => window.hostTest.emit('sia://browser-download', { id: 'file', fileName: 'fixture.zip', state: 'started', receivedBytes: 80, totalBytes: 100 }));
    await page.getByText('80%', { exact: false }).waitFor();
    assert.equal(await page.getByPlaceholder('搜索下载').inputValue(), 'fixture');
    await page.locator('.browser-download-entry').click({ button: 'right' });
    await submenu.waitFor();
    b = await submenu.boundingBox();
    assert.ok(b.x >= 8 && b.y >= 8 && b.x + b.width <= 792 && b.y + b.height <= 712);
    await page.getByPlaceholder('搜索下载').click();
    assert.equal(await submenu.count(), 0);
    assert.equal(await page.getByPlaceholder('搜索下载').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('.browser-download-context-layer').count(), 0, '子层不得用全窗遮罩阻塞父层');

    // 关闭消息清空内容，迟到的旧显示消息不能复活面板；新显示批次可以正常打开。
    const closedRevision = ++revision;
    await page.evaluate(revision => window.hostTest.emit('sia://browser-menu-closed', { revision }), closedRevision);
    await root.waitFor({ state: 'detached' });
    await page.evaluate(payload => window.hostTest.emit('sia://browser-menu-state', payload), downloadPayload);
    await page.waitForTimeout(60);
    assert.equal(await root.count(), 0);
    await open('history');
    await page.mouse.click(790, 700);
    assert.ok(await page.evaluate(() => window.hostTest.calls.some(call => call.command === 'close_browser_menu')));
    const reports = await page.evaluate(() => window.hostTest.calls.filter(call => call.command === 'update_browser_menu_regions').map(call => call.args));
    for (let i = 1; i < reports.length; i++) {
      if (reports[i].revision === reports[i - 1].revision) assert.ok(reports[i].sequence > reports[i - 1].sequence);
    }
    assert.deepEqual(errors, []);
    console.log('PASS 六类统一宿主、固定根宽、明暗主题、异步快照与关闭竞态、扩展子层双向避让、下载搜索进度及父层连续操作');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
