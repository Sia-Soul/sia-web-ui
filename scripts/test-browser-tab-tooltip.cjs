/** 无头验证收缩树提示的内容、取消行为和独立提示窗口，不启动用户桌面浏览器。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
const base = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1446/';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://tooltip.example/**', route => route.abort());
    await page.addInitScript(() => {
      window.tooltipCalls = [];
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        window.tooltipCalls.push({ command, args });
        if (command === 'current_window_label') return 'main';
        if (command === 'list_browser_extensions') return [];
        if (command === 'load_browser_state') return {
          version: 3, activeId: 'blank', verticalPanelPinned: false, showBookmarksBar: false,
          groups: [{ id: 'local', name: '本地完整环境名称', color: '#5548f6', smallGroups: [{ id: 'partner', name: '合作方完整名称' }] }],
          tabs: [
            { id: 'blank', title: '新标签页', url: '', groupId: 'local', loading: false, hasWebview: false, sleeping: false, audible: false, muted: false },
            { id: 'target', title: '商品审批管理系统', url: 'https://tooltip.example/brand-management', groupId: 'local', smallGroupId: 'partner', loading: false, hasWebview: false, sleeping: true, audible: false, muted: true },
          ], bookmarks: [],
        };
      } } };
    });
    await page.goto(base);
    const tab = page.locator('.vertical-tree-compact-tab[data-browser-tab-id="target"]');
    await tab.waitFor();
    await tab.hover();
    await page.waitForFunction(() => window.tooltipCalls.some(call => call.command === 'show_browser_tab_tooltip'));
    let show = await page.evaluate(() => window.tooltipCalls.filter(call => call.command === 'show_browser_tab_tooltip').at(-1).args);
    assert.equal(show.payload.title, '商品审批管理系统');
    assert.equal(show.payload.url, 'https://tooltip.example/brand-management');
    assert.match(show.payload.detail, /休眠.*已静音/);
    assert.ok(show.anchor.width > 0);
    await page.mouse.move(500, 300);
    await page.waitForFunction(() => window.tooltipCalls.at(-1).command === 'close_browser_tab_tooltip');
    await page.getByRole('button', { name: '分组：本地完整环境名称', exact: true }).hover();
    await page.waitForFunction(() => window.tooltipCalls.some(call => call.command === 'show_browser_tab_tooltip' && call.args.payload.title === '本地完整环境名称'));
    show = await page.evaluate(() => window.tooltipCalls.filter(call => call.command === 'show_browser_tab_tooltip').at(-1).args);
    assert.equal(show.payload.detail, '2 个标签页');
    await page.getByRole('button', { name: '小分组：合作方完整名称', exact: true }).hover();
    await page.waitForFunction(() => window.tooltipCalls.some(call => call.command === 'show_browser_tab_tooltip' && call.args.payload.title === '合作方完整名称'));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.waitForFunction(() => window.tooltipCalls.at(-1).command === 'close_browser_tab_tooltip');
    // 快速经过后不得留下延迟打开；这里只等待被测的 180ms 悬停计时器。
    const count = await page.evaluate(() => window.tooltipCalls.filter(call => call.command === 'show_browser_tab_tooltip').length);
    await tab.hover();
    await page.mouse.move(500, 300);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.tooltipCalls.filter(call => call.command === 'show_browser_tab_tooltip').length), count);
    await tab.hover();
    await page.waitForFunction(n => window.tooltipCalls.filter(call => call.command === 'show_browser_tab_tooltip').length > n, count);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.tooltipCalls.at(-1).command === 'close_browser_tab_tooltip');

    const popup = await browser.newPage({ viewport: { width: 320, height: 160 } });
    popup.on('pageerror', error => errors.push(error.message));
    await popup.addInitScript(() => {
      window.popupCalls = [];
      window.__TAURI__ = { event: { listen: async (_name, callback) => { window.updateTooltip = callback; return () => {}; } }, core: { invoke: async (command, args) => {
        window.popupCalls.push({ command, args });
        if (command === 'get_browser_tab_tooltip_state') return {
          title: '商品审批管理系统', url: 'https://tooltip.example/brand-management', detail: '休眠，已静音', darkMode: false, revision: 1,
        };
      } } };
    });
    await popup.goto(`${base}menu.html?tab-tooltip`);
    const bubble = popup.locator('.browser-tab-tooltip');
    await bubble.waitFor({ state: 'visible' });
    // 首次悬停也必须请求显示原生窗口，不能只验证 DOM 或第二次内容更新。
    await popup.waitForFunction(() => window.popupCalls.some(call => call.command === 'present_browser_tab_tooltip' && call.args.revision === 1 && call.args.height > 0), undefined, { timeout: 3000 });
    assert.match(await bubble.innerText(), /商品审批管理系统/);
    assert.match(await bubble.innerText(), /休眠，已静音/);
    const bounds = await bubble.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 320 && bounds.y + bounds.height <= 160);
    assert.equal(await bubble.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await popup.screenshot({ path: 'logs/browser-tab-tooltip.png' });
    // 超过两行的名称不省略，原生层收到真实高度后再展示窗口。
    await popup.evaluate(() => window.updateTooltip({ payload: { title: '这是需要完整显示的长分组名称'.repeat(12), detail: '12 个标签页', darkMode: true, revision: 2 } }));
    await popup.waitForFunction(() => window.popupCalls.some(call => call.command === 'present_browser_tab_tooltip' && call.args.revision === 2 && call.args.height > 160));
    const height = await popup.evaluate(() => window.popupCalls.filter(call => call.command === 'present_browser_tab_tooltip' && call.args.revision === 2).at(-1).args.height);
    await popup.setViewportSize({ width: 320, height: Math.ceil(height) + 24 });
    assert.equal(await bubble.locator('strong').evaluate(el => el.scrollHeight <= el.clientHeight), true);
    assert.deepEqual(errors, []);
    console.log('PASS 收缩标签气泡：标题/网址/状态、完整分组名、移出/滚动/Escape关闭、快速经过取消、独立窗口排版。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
