/** 隔离下载面板回归：原生图标桥、紧凑行高、新下载一次性高亮及亮暗主题。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    // 自动打开面板也需传递首次触发时间；极快完成的下载不能丢失高亮或重置计时。
    const main = await browser.newPage();
    await main.addInitScript(() => {
      window.autoDownload = { handlers: {}, panel: null };
      window.__TAURI__ = { event: { listen: async (name, handler) => {
        window.autoDownload.handlers[name] = handler; return () => {};
      } }, core: { invoke: async (command, args) => {
        if (command === 'current_window_label') return 'main';
        if (command === 'show_browser_panel') window.autoDownload.panel = args.payload;
        // 测试窗口独立会话存储模拟磁盘保存，用于验证重启后的时间顺序。
        if (command === 'save_browser_state') sessionStorage.setItem('download-order-state', JSON.stringify(args.state));
        if (command === 'load_browser_state') return JSON.parse(sessionStorage.getItem('download-order-state') || 'null');
      } } };
    });
    // 主壳与浮层使用同一个隔离回归服务。
    await main.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1440/');
    await main.waitForFunction(() => window.autoDownload.handlers['sia://browser-download']);
    await main.evaluate(() => {
      const emit = task => window.autoDownload.handlers['sia://browser-download']({ payload: task });
      emit({ id: 'new', state: 'started', fileName: '自动下载.xlsx' });
      emit({ id: 'new', state: 'finished', success: true, fileName: '自动下载.xlsx', filePath: 'D:\\auto.xlsx' });
    });
    await main.waitForFunction(() => window.autoDownload.panel?.entries?.[0]?.highlightStartedAt > 0);
    assert.equal(await main.evaluate(() => window.autoDownload.panel.entries[0].state), 'finished');
    // 数字 ID 的对象枚举顺序与触发顺序相反；同毫秒触发和旧任务后完成都不得打乱列表。
    await main.evaluate(() => {
      const emit = task => window.autoDownload.handlers['sia://browser-download']({ payload: task });
      const originalNow = Date.now;
      Date.now = () => 1800000000000;
      emit({ id: '200', state: 'started', fileName: '先触发.xlsx' });
      emit({ id: '100', state: 'started', fileName: '后触发.xlsx' });
      emit({ id: '200', state: 'finished', fileName: '先触发.xlsx', success: true });
      Date.now = originalNow;
    });
    await main.waitForFunction(() => window.autoDownload.panel?.entries?.[0]?.id === '100');
    assert.deepEqual(await main.evaluate(() => window.autoDownload.panel.entries.slice(0, 2).map(entry => entry.id)), ['100', '200']);
    await main.evaluate(() => window.autoDownload.handlers['sia://browser-download']({ payload: { id: '100', state: 'finished', success: true } }));
    await main.waitForFunction(() => JSON.parse(sessionStorage.getItem('download-order-state') || '{}').downloads?.some(item => item.id === '100' && item.startedAt > 0));
    await main.reload();
    await main.waitForFunction(() => window.autoDownload.handlers['sia://browser-download']);
    await main.keyboard.press('Control+j');
    await main.waitForFunction(() => window.autoDownload.panel?.entries?.[0]?.id === '100');
    assert.deepEqual(await main.evaluate(() => window.autoDownload.panel.entries.slice(0, 2).map(entry => entry.id)), ['100', '200'], '恢复历史后仍必须按触发时间排列');
    await main.close();
    const page = await browser.newPage({ viewport: { width: 440, height: 680 } });
    await page.addInitScript(() => {
      window.downloadView = { handlers: {}, calls: [], payload: {
        kind: 'downloads', darkMode: false, items: [], hitRegionRevision: 1,
        entries: [
          { id: 'old', title: '商品报审导入模板.xlsx', fileName: '商品报审导入模板.xlsx', filePath: 'D:\\fixture.xlsx', state: 'finished', success: true, startedAt: 100 },
          { id: 'failed', title: '失败.zip', state: 'finished', success: false, startedAt: 200 },
        ],
      } };
      window.__TAURI__ = { event: { listen: async (name, handler) => {
        window.downloadView.handlers[name] = handler; return () => {};
      } }, core: { invoke: async (command, args) => {
        window.downloadView.calls.push({ command, args });
        if (command === 'get_browser_menu_state') return structuredClone(window.downloadView.payload);
        if (command === 'get_download_file_icon') return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="1" width="24" height="30" fill="#fff" stroke="#999"/><rect y="8" width="20" height="17" fill="#159b62"/><text x="5" y="21" fill="white" font-size="14">X</text></svg>');
      } } };
    });
    await page.goto(`${(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1440').replace(/\/$/, '')}/menu.html`);
    const row = id => page.locator(`[data-download-id="${id}"]`);
    await row('old').locator('img').waitFor();
    assert.ok((await row('old').boundingBox()).height <= 58, '完成项应使用紧凑两行布局');
    assert.equal(await row('old').getByText('下载完成').count(), 0);
    await row('old').getByRole('button', { name: '打开文件' }).waitFor();
    await row('failed').getByText('下载失败').waitFor();
    assert.deepEqual(await page.locator('[data-download-id]').evaluateAll(rows => rows.map(row => row.dataset.downloadId)), ['failed', 'old']);
    assert.equal(await page.locator('.browser-download-entry__highlight').count(), 0, '打开历史列表不能闪烁');
    assert.ok(await page.evaluate(() => window.downloadView.calls.some(call => call.command === 'get_download_file_icon' && call.args.filePath === 'D:\\fixture.xlsx')));
    // 用可控动画时钟验证中段渐变和总时长，避免机器繁忙造成毫秒级测试抖动。
    await page.evaluate(() => window.downloadView.handlers['sia://browser-download']({ payload: {
      id: 'fresh', fileName: '新下载.xlsx', state: 'started', receivedBytes: 0, totalBytes: 100,
    } }));
    const flash = row('fresh').locator('.browser-download-entry__highlight');
    await flash.waitFor();
    assert.equal(await page.locator('[data-download-id]').first().getAttribute('data-download-id'), 'fresh');
    assert.equal(await flash.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(255, 145, 0, 0.32)');
    await flash.evaluate(element => {
      const animation = element.getAnimations()[0];
      animation.pause(); animation.currentTime = 400; window.downloadAnimation = animation;
    });
    assert.ok(Number(await flash.evaluate(element => getComputedStyle(element).opacity)) > 0.9);
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/download-highlight-orange.png' });
    await page.evaluate(() => window.downloadView.handlers['sia://browser-download']({ payload: { id: 'fresh', state: 'progress', receivedBytes: 55, totalBytes: 100 } }));
    await row('fresh').getByText('55% · 55 B / 100 B').waitFor();
    assert.ok(await flash.evaluate(element => element.getAnimations()[0] === window.downloadAnimation), '进度刷新不应重建动画');
    await page.evaluate(() => window.downloadView.handlers['sia://browser-download']({ payload: { id: 'old', state: 'finished', success: true } }));
    assert.equal(await page.locator('[data-download-id]').first().getAttribute('data-download-id'), 'fresh', '旧任务完成不应排到新任务前面');
    await flash.evaluate(element => { element.getAnimations()[0].currentTime = 1100; });
    const middle = Number(await flash.evaluate(element => getComputedStyle(element).opacity));
    assert.ok(middle > 0 && middle < 1, '高亮淡出应包含中间透明度');
    await flash.evaluate(element => { element.getAnimations()[0].currentTime = 1500; });
    assert.equal(Number(await flash.evaluate(element => getComputedStyle(element).opacity)), 0);
    assert.equal(await flash.evaluate(element => getComputedStyle(element).pointerEvents), 'none');
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/download-compact-light.png' });
    // 新显示批次必须增加版本，否则宿主按约定拒绝旧载荷。
    await page.evaluate(() => window.downloadView.handlers['sia://browser-menu-state']({ payload: { ...window.downloadView.payload, hitRegionRevision: 2, darkMode: true } }));
    await row('old').waitFor();
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/download-compact-dark.png' });
    assert.equal(await page.locator('.browser-download-entry__highlight').count(), 0);
    console.log('PASS 下载触发时间倒序、同毫秒顺序、旧任务完成不改排序、橙色高亮、1.5秒平滑淡出、进度不重启及主题切换');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
