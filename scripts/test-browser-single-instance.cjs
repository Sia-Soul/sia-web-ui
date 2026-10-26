/** 使用独立诊断目录启动真实 EXE，验证文件、链接复用现有进程，测试结束只清理自己创建的进程。 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const assert = require('node:assert/strict');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await check(); if (result) return result; await delay(100); }
  throw new Error(`${label} 超时`);
}
(async () => {
  const target = browserTargetDirectory();
  const directory = path.join(target, 'startup-tests', `single-instance-${Date.now()}`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '.sia-startup-test'), 'Sia isolated instance test\n', 'utf8');
  const firstFile = path.join(directory, '首个网页.html');
  const secondFile = path.join(directory, '第二个 网页 #.htm');
  fs.writeFileSync(firstFile, '<!doctype html><title>首次打开文件</title><h1>first</h1>', 'utf8');
  fs.writeFileSync(secondFile, '<!doctype html><title>复用窗口文件</title><h1>second</h1>', 'utf8');
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const site = http.createServer((_, response) => response.end('<!doctype html><title>外部链接</title>link'));
  await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
  const link = `http://127.0.0.1:${site.address().port}/?query=a|b&value=1`;
  const executable = path.join(target, 'release', 'sia-browser.exe');
  const children = [];
  const launch = args => {
    const child = spawn(executable, ['--diagnostic-data-dir', directory, ...args], {
      windowsHide: true, stdio: 'ignore', cwd: directory,
      env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
    });
    children.push(child);
    return child;
  };
  let browser;
  try {
    const primary = launch(['--open-file', firstFile]);
    const endpoint = `http://127.0.0.1:${port}`;
    await until(async () => { try { return (await fetch(`${endpoint}/json/version`)).ok; } catch { return false; } }, '主进程启动');
    browser = await chromium.connectOverCDP(endpoint);
    const main = await until(() => browser.contexts().flatMap(context => context.pages()).find(page => /tauri\.localhost\/(?:index.html)?$/.test(page.url())), '主界面');
    const read = () => main.evaluate(() => window.__TAURI__.core.invoke('get_floating_tab_panel_state'));
    const first = await until(async () => { const state = await read(); return state?.tabs?.some(tab => tab.title === '首次打开文件') && state; }, '首次文件加载');
    await main.evaluate(() => window.__TAURI__.core.invoke('browser_window_action', { action: 'minimize' }));
    const secondary = launch(['--open-file', path.basename(secondFile)]);
    await until(() => secondary.exitCode !== null, '第二进程转交后退出');
    assert.equal(secondary.exitCode, 0);
    const second = await until(async () => { const state = await read(); return state?.tabs?.some(tab => tab.title === '复用窗口文件') && state; }, '现有窗口打开第二个文件');
    assert.equal(second.tabs.length, first.tabs.length + 1);
    assert.ok(second.tabs.some(tab => tab.id === first.activeId));
    assert.equal(second.tabs.find(tab => tab.id === second.activeId).groupId, 'group-root');
    assert.equal(await main.evaluate(() => window.__TAURI__.window.getCurrentWindow().isMinimized()), false);
    for (let index = 0; index < 2; index++) {
      const next = launch(['--open-url', link]);
      await until(() => next.exitCode !== null, '链接进程转交后退出');
      assert.equal(next.exitCode, 0);
      await until(async () => (await read())?.tabs?.filter(tab => tab.url === link).length === index + 1, '同一链接分别新增标签');
    }
    const final = await read();
    assert.equal(final.tabs.length, first.tabs.length + 3);
    // 模拟直接双击快捷方式：没有网址参数时只激活原窗口，标签数量和当前标签均保持不变。
    await main.evaluate(() => window.__TAURI__.core.invoke('browser_window_action', { action: 'minimize' }));
    await until(() => main.evaluate(() => window.__TAURI__.window.getCurrentWindow().isMinimized()), '窗口进入最小化');
    const shortcut = launch([]);
    await until(() => shortcut.exitCode !== null, '快捷方式启动进程退出');
    assert.equal(shortcut.exitCode, 0);
    await until(async () => !(await main.evaluate(() => window.__TAURI__.window.getCurrentWindow().isMinimized())), '快捷方式恢复原窗口');
    await until(() => main.evaluate(() => window.__TAURI__.core.invoke('is_browser_window_active')), '快捷方式激活原窗口');
    const afterShortcut = await read();
    assert.equal(afterShortcut.tabs.length, final.tabs.length);
    assert.equal(afterShortcut.activeId, final.activeId);
    assert.equal(primary.exitCode, null);
    assert.deepEqual(await main.evaluate(() => window.__TAURI__.core.invoke('pending_browser_opens')), []);
    console.log('PASS 真实 EXE：文件与链接复用窗口、无网址快捷方式恢复并激活原窗口、第二进程退出且不新增或切换标签');
  } finally {
    for (const child of children) {
      if (child.exitCode === null) await new Promise(resolve => spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('exit', resolve));
    }
    if (browser) await browser.close().catch(() => {});
    site.closeAllConnections();
    await new Promise(resolve => site.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
