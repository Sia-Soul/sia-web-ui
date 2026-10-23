/** 真实桌面回归：在隔离资料中恢复网页，使用系统指针悬停收缩页签，检查原生气泡可见性与层级。 */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout, label) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value) return value; await delay(150); }
  throw new Error(`${label} 超时`);
}
async function run() {
  const target = browserTargetDirectory();
  const directory = path.join(target, 'tooltip-tests', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '.sia-startup-test'), 'Sia isolated tooltip test\n');
  let requests = 0;
  const server = http.createServer((_, response) => { requests++; response.end('<title>Tooltip fixture</title><h1>Native WebView tooltip fixture</h1>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(directory, 'browser-state.json'), JSON.stringify({
    version: 3, activeId: 'tooltip-tab', verticalPanelPinned: false,
    groups: [{ id: 'local', name: '悬停测试分组', color: '#5548f6', smallGroups: [] }],
    tabs: [{ id: 'tooltip-tab', title: '等待网页加载', url, groupId: 'local', sleeping: false, loading: false, hasWebview: false }],
  }));
  const portServer = http.createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const debugPort = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const executable = process.argv[2] || path.join(target, 'release/sia-browser.exe');
  const child = spawn(executable, ['--diagnostic-data-dir', directory], { windowsHide: true, stdio: 'ignore',
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}` } });
  console.log(`Diagnostic directory: ${directory}`);
  let browser, originalCursor;
  const probe = (action = 'inspect', x = 0, y = 0, wait = 0) => JSON.parse(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'probe-browser-tooltip.ps1'), '-TestProcessId', String(child.pid), '-Action', action, '-X', String(x), '-Y', String(y), '-WaitMs', String(wait)], { windowsHide: true, encoding: 'utf8', timeout: 12000 }));
  // 系统指针是共享输入；仅当外部移动打断悬停时重试，气泡自身失败仍直接报错。
  const hover = (x, y, wait) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = probe('hover', x, y, wait);
      if (state.CursorX === state.TargetX && state.CursorY === state.TargetY) return state;
    }
    throw new Error('悬停测试被外部鼠标移动打断，无法验证');
  };
  try {
    await until(async () => { try { return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; } catch { return false; } }, 20000, '调试端口');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const main = await until(() => browser.contexts().flatMap(context => context.pages()).find(page => /tauri\.localhost\/(?:index.html)?$/.test(page.url())), 10000, '主页面').catch(error => { console.log('Renderer URLs after wait:', browser.contexts().flatMap(context => context.pages()).map(page => page.url())); throw error; });
    // 原生初始化完成后才能激活，避免初始窗口样式恢复覆盖测试的前台状态。
    await main.locator('.browser-toolbar__navigation').waitFor({ state: 'attached' });
    originalCursor = probe('hover', 600, 20);
    assert.ok(originalCursor.Windows.some(window => window.Title === '西娅浏览器' && window.Foreground), `必须先激活测试窗口再验证悬停: ${JSON.stringify(originalCursor)}`);
    const tab = main.locator('[data-browser-tab-id="tooltip-tab"].vertical-tree-compact-tab');
    await tab.waitFor();
    await until(() => requests > 0, 15000, '真实网页加载');
    const bounds = await tab.boundingBox();
    // 悬停真实指针并查询窗口可见性，DOM 可见不能证明气泡位于原生网页之上。
    const windowState = hover(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 900);
    const nativeState = await main.evaluate(() => window.__TAURI__.core.invoke('get_browser_tab_tooltip_state'));
    console.log(JSON.stringify({ bounds, nativeState, windowState }));
    const popup = windowState.Windows.find(window => window.Title === '标签页提示');
    assert.ok(nativeState?.title, '悬停后必须保留提示状态');
    assert.ok(popup?.Visible, '原生气泡窗口必须显示');
    assert.ok(popup.Topmost, '气泡必须位于网页 WebView 上方');
    assert.ok(!popup.Foreground, '气泡不能抢走网页焦点');
    assert.ok(windowState.Windows.some(window => window.Title === '西娅浏览器' && window.Foreground), '悬停期间主窗口必须保持前台');
    probe('hover', 600, 20);
    await delay(250);
    assert.equal(probe().Windows.find(window => window.Title === '标签页提示').Visible, false, '移出必须关闭');
    // 再次悬停另一个项目，验证原生可见状态与内容更新没有在首次关闭后失效。
    const group = await main.locator('.vertical-tree-compact-group__title').first().boundingBox();
    const repeated = hover(group.x + group.width / 2, group.y + group.height / 2, 600);
    assert.ok(repeated.Windows.find(window => window.Title === '标签页提示')?.Visible, '再次悬停必须显示');
    const groupState = await main.evaluate(() => window.__TAURI__.core.invoke('get_browser_tab_tooltip_state'));
    assert.equal(groupState?.title, '悬停测试分组');
    probe('hover', 600, 20, 250);
    assert.equal(probe().Windows.find(window => window.Title === '标签页提示').Visible, false, '再次移出必须关闭');
    console.log('PASS native tooltip over real WebView, no focus stealing, closes on pointer leave');
  } finally {
    if (originalCursor) { try { probe('restore', originalCursor.OriginalX, originalCursor.OriginalY); } catch {} }
    if (child.exitCode === null) await new Promise(resolve => spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('exit', resolve));
    if (browser) await browser.close().catch(() => {});
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
