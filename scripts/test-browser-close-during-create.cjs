// 使用独立资料和真实 IPC，让关闭请求进入 WebView2 创建期间的消息循环，检查原生线程仍可响应。
const { chromium } = require('playwright');
const { spawn, execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
/** 对原生调用设置期限，防止死锁导致整个回归脚本无限等待。 */
function limit(promise, ms, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms);
  })]).finally(() => clearTimeout(timer));
}
async function run() {
  const target = browserTargetDirectory();
  const executable = process.argv[2] || path.join(target, 'release/sia-browser.exe');
  const directory = path.join(target, 'close-tests', `close-create-${Date.now()}`);
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  let slowRequests = 0;
  let closedRequests = 0;
  const stateReports = [];
  let downloadResponse;
  const downloadBytes = Buffer.alloc(128 * 1024, 37);
  // 挂起 HTTP 响应模拟无法加载的网站，无需访问外网或读取用户资料。
  const server = http.createServer((request, response) => {
    if (request.url === '/download') {
      // 分两段传输，覆盖关闭页签后仍须保留下载宿主，文件只保存到本轮 D 盘测试目录。
      response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="release-fixture.bin"', 'Content-Length': downloadBytes.length });
      response.write(downloadBytes.subarray(0, downloadBytes.length / 2));
      downloadResponse = response;
      return;
    }
    if (request.url.startsWith('/state-report?')) {
      stateReports.push(new URL(request.url, 'http://localhost').searchParams.get('state'));
      response.end('ok');
      return;
    }
    if (request.url.startsWith('/state?')) {
      // 真实磁盘资料回归：仅在临时 Profile 写入固定测试值，回收后重新读取 Cookie 和 localStorage。
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<script>${request.url.includes('write=1') ? "localStorage.setItem('release-fixture', 'saved'); document.cookie='release-fixture=saved; path=/; max-age=3600';" : ''}fetch('/state-report?state='+encodeURIComponent(localStorage.getItem('release-fixture')+'|'+document.cookie));</script>`);
      return;
    }
    if (request.url === '/slow') {
      slowRequests++;
      response.on('close', () => { closedRequests++; });
      return;
    }
    response.end('<!doctype html><title>Replacement ready</title><h1>ready</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const portServer = http.createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const debugPort = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const child = spawn(executable, ['--diagnostic-data-dir', directory], {
    windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}` },
  });
  const diagnostics = [];
  child.stderr.on('data', data => diagnostics.push(data.toString('utf8')));
  let browser;
  let running = true;
  try {
    const endpoint = `http://127.0.0.1:${debugPort}`;
    await limit((async () => {
      while (running) {
        try { if ((await fetch(`${endpoint}/json/version`)).ok) return; } catch {}
        if (child.exitCode !== null) throw new Error(`测试浏览器提前退出：${child.exitCode}`);
        await delay(100);
      }
    })(), 20000, '启动测试浏览器');
    browser = await chromium.connectOverCDP(endpoint);
    let main;
    await limit((async () => {
      while (running && !(main = browser.contexts().flatMap(context => context.pages()).find(page => /tauri\.localhost\/?$|tauri\.localhost\/index.html/.test(page.url())))) await delay(100);
    })(), 10000, '等待壳层');
    await main.locator('.browser-toolbar__navigation').waitFor({ state: 'attached' });
    const invoke = (command, args = {}) => main.evaluate(({ command, args }) => window.__TAURI__.core.invoke(command, args), { command, args });
    const bounds = { x: 300, y: 60, width: 600, height: 500 };
    const checkRelease = process.env.SIA_CHECK_PROFILE_RELEASE === '1';
    let reusedAt = 0;
    if (checkRelease) {
      await limit(invoke('open_browser_tab', { tabId: 'shared-a', groupId: 'loading-scope-shared', url: `${url}/state?write=1`, bounds }), 15000, '写入隔离资料');
      await limit((async () => { while (!stateReports.length) await delay(20); })(), 5000, '等待资料写入');
      assert.equal(stateReports[0], 'saved|release-fixture=saved');
      await limit(invoke('open_browser_tab', { tabId: 'shared-b', groupId: 'loading-scope-shared', url: `${url}/ready`, bounds }), 15000, '打开同组另一页');
      await limit(invoke('close_browser_tab', { tabId: 'shared-a' }), 5000, '关闭同组部分页签');
      await invoke('set_download_preferences', { directory: path.join(directory, 'downloads'), askBeforeDownload: false });
      await main.evaluate(async () => {
        window.releaseDownloads = [];
        await window.__TAURI__.event.listen('sia://browser-download', event => window.releaseDownloads.push(event.payload));
      });
      await limit(invoke('open_browser_tab', { tabId: 'downloading', groupId: 'download-scope-active', url: `${url}/download`, bounds }), 15000, '启动下载');
      await limit((async () => { while (!(await main.evaluate(() => window.releaseDownloads.some(event => event.state === 'started')))) await delay(20); })(), 5000, '下载进入进行中');
      await limit(invoke('close_browser_tab', { tabId: 'downloading' }), 5000, '下载期间关闭页签');
      // 回收宽限期内重新进入相同隔离目录，旧回收任务不得干扰新网页。
      await limit(invoke('open_browser_tab', { tabId: 'reuse-old', groupId: 'loading-scope-reused', url: `${url}/ready`, bounds }), 15000, '创建待回收分组');
      await limit(invoke('close_browser_tab', { tabId: 'reuse-old' }), 5000, '触发延迟回收');
      await limit(invoke('open_browser_tab', { tabId: 'reuse-live', groupId: 'loading-scope-reused', url: `${url}/ready`, bounds }), 15000, '宽限期内重新使用分组');
      reusedAt = Date.now();
    }
    // 反向顺序覆盖用户先关页、再恢复相邻休眠页并切离窗口的路径。
    const closeFirst = process.env.SIA_CLOSE_FIRST === '1';
    for (let index = 0; index < 6; index++) {
      const victim = `loading-${index}`;
      const replacement = `replacement-${index}`;
      await limit(invoke('open_browser_tab', { tabId: victim, groupId: `loading-scope-${index}`, url: `${url}/slow`, bounds }), 15000, '打开挂起网页');
      await limit((async () => { while (running && slowRequests <= index) await delay(20); })(), 5000, '挂起请求进入服务器');
      // 新隔离目录强制创建新 WebView；同时从壳层提交关闭，覆盖 WebView2 消息泵重入。
      const started = Date.now();
      await limit(main.evaluate(async ({ victim, replacement, index, url, bounds, closeFirst, minimize }) => {
        const invoke = window.__TAURI__.core.invoke;
        if (closeFirst) {
          const closing = invoke('close_browser_tab', { tabId: victim });
          const opening = invoke('open_browser_tab', { tabId: replacement, groupId: `replacement-scope-${index}`, url: 'http://127.0.0.1:1/', bounds });
          await Promise.all([closing, opening, ...(minimize ? [invoke('browser_window_action', { action: 'minimize' })] : [])]);
          return;
        }
        const opening = invoke('open_browser_tab', { tabId: replacement, groupId: `replacement-scope-${index}`, url: `${url}/ready`, bounds });
        await new Promise(resolve => setTimeout(resolve, 20));
        await Promise.all([opening, invoke('close_browser_tab', { tabId: victim })]);
      }, { victim, replacement, index, url, bounds, closeFirst, minimize: process.env.SIA_CLOSE_MINIMIZE !== '0' }), 15000, `第 ${index + 1} 轮创建时关闭`);
      if (closeFirst && process.env.SIA_CLOSE_MINIMIZE !== '0') {
        // 恢复自身测试窗口后检查心跳，不能把最小化的网页脚本节流当作原生死锁。
        await require('node:util').promisify(execFile)('powershell', ['-NoProfile', '-File', path.join(__dirname, 'probe-browser-test-window.ps1'), '-TestProcessId', String(child.pid), '-Restore'], { windowsHide: true, timeout: 10000 });
      }
      assert.equal(await limit(invoke('current_window_label'), 3000, '检查原生线程'), 'main');
      assert.equal(await limit(invoke('switch_browser_tab', { tabId: victim, groupId: `loading-scope-${index}`, bounds }), 3000, '检查旧页已移除'), false);
      // 关闭必须终止原网站的挂起请求，不能仅隐藏原页面来掩盖退出卡顿。
      await limit((async () => { while (running && closedRequests <= index) await delay(20); })(), 5000, '原网站请求释放');
      assert.equal(await limit(invoke('switch_browser_tab', { tabId: replacement, groupId: `replacement-scope-${index}`, bounds }), 3000, '检查新页可用'), true);
      await limit(invoke('close_browser_tab', { tabId: replacement }), 5000, '清理本轮页签');
      console.log(`PASS ${index + 1}/6: ${closeFirst ? (process.env.SIA_CLOSE_MINIMIZE !== '0' ? '先关闭并切离窗口' : '先关闭再创建') : '创建期间关闭'}，旧网站释放，新隔离网页可用，原生线程响应正常（${Date.now() - started}ms）`);
    }
    // 再次进入已经关闭所有页签的隔离空间，验证保留的环境可以继续承载新页面。
    await limit(invoke('open_browser_tab', { tabId: 'reopen', groupId: 'loading-scope-0', url: `${url}/ready`, bounds }), 15000, '重新打开隔离空间');
    assert.equal(await limit(invoke('switch_browser_tab', { tabId: 'reopen', groupId: 'loading-scope-0', bounds }), 3000, '重新激活隔离空间'), true);
    await limit(invoke('close_browser_tab', { tabId: 'reopen' }), 5000, '关闭重开页');
    if (checkRelease) {
      while (Date.now() - reusedAt < 35000) {
        await delay(500);
        assert.equal(await limit(invoke('current_window_label'), 3000, '等待复用保护期间响应'), 'main');
      }
      assert.equal(await limit(invoke('switch_browser_tab', { tabId: 'reuse-live', groupId: 'loading-scope-reused', bounds }), 3000, '宽限期后复用页仍可使用'), true);
      await limit(invoke('close_browser_tab', { tabId: 'reuse-live' }), 5000, '关闭复用页');
      assert.equal(await limit(invoke('switch_browser_tab', { tabId: 'shared-b', groupId: 'loading-scope-shared', bounds }), 3000, '同组剩余网页仍可使用'), true);
      await limit(invoke('close_browser_tab', { tabId: 'shared-b' }), 5000, '关闭同组最后一页');
      assert.ok(downloadResponse && !downloadResponse.destroyed, '关闭页签不能中止正在进行的下载');
      downloadResponse.end(downloadBytes.subarray(downloadBytes.length / 2));
      await limit((async () => { while (!(await main.evaluate(() => window.releaseDownloads.some(event => event.state === 'finished' && event.success)))) await delay(20); })(), 10000, '后台下载正常完成');
      assert.deepEqual(fs.readFileSync(path.join(directory, 'downloads/release-fixture.bin')), downloadBytes);
      const checkRetired = async () => {
        // 正常 Close 后留 30 秒清理宽限期；等待期间持续验证 UI IPC，不能以不响应换内存释放。
        for (let tick = 0; tick < 70; tick++) {
          await delay(500);
          assert.equal(await limit(invoke('current_window_label'), 3000, '回收期间主线程响应'), 'main');
        }
        const { stdout } = await require('node:util').promisify(execFile)('powershell', ['-NoProfile', '-File', path.join(__dirname, 'probe-browser-profile-processes.ps1'), '-TestDirectory', directory, '-ScopePrefixes', 'loading-scope-,replacement-scope-,download-scope-', '-IncludeChildren'], { windowsHide: true, timeout: 10000 });
        const processes = JSON.parse(stdout.replace(/^\uFEFF/, ''));
        console.log(`空闲分组及子进程：${JSON.stringify(processes)}`);
        assert.equal(processes.length, 0, '全部页签关闭后不应永久保留分组内核及子进程');
      };
      await checkRetired();
      await limit(invoke('open_browser_tab', { tabId: 'read-state', groupId: 'loading-scope-shared', url: `${url}/state?read=1`, bounds }), 15000, '回收后重新打开隔离空间');
      await limit((async () => { while (stateReports.length < 2) await delay(20); })(), 5000, '回收后读取资料');
      assert.equal(stateReports[1], 'saved|release-fixture=saved', '回收必须保留持久化 Cookie 和 localStorage');
      await limit(invoke('close_browser_tab', { tabId: 'read-state' }), 5000, '关闭资料验证页');
      await checkRetired();
      console.log('PASS: 同组剩余页及下载保留，所有空闲内核及子进程释放，重新打开后 Cookie/localStorage 保留');
    }
  } catch (error) {
    // 可选只读采样器须由诊断者显式指定，在短暂挂起自行恢复前记录符号调用栈。
    if (process.env.SIA_STACK_PYTHON && process.env.SIA_STACK_SCRIPT) {
      try {
        fs.writeFileSync(path.join(directory, 'native-stack.log'), execFileSync(process.env.SIA_STACK_PYTHON, [process.env.SIA_STACK_SCRIPT, String(child.pid)], { windowsHide: true, timeout: 20000 }));
      } catch (captureError) {
        if (captureError.stdout) fs.writeFileSync(path.join(directory, 'native-stack.log'), captureError.stdout);
      }
    }
    // 超时后同时检查 Windows 心跳，区分原生挂起与后台网页脚本节流。
    try {
      const output = execFileSync('powershell', ['-NoProfile', '-File', path.join(__dirname, 'inspect-browser-hang.ps1'), '-BrowserProcessId', String(child.pid)], { windowsHide: true, timeout: 12000 });
      fs.writeFileSync(path.join(directory, 'wait-chain.log'), output);
    } catch (probeError) {
      if (probeError.stdout) fs.writeFileSync(path.join(directory, 'wait-chain.log'), probeError.stdout);
    }
    // 诊断指定采样器时也记录等待链中的目标线程，仅用于隔离测试进程的 WebView2。
    if (process.env.SIA_STACK_PYTHON && process.env.SIA_WAITER_SCRIPT) {
      const chain = fs.readFileSync(path.join(directory, 'wait-chain.log'), 'utf8');
      const waiter = chain.match(/Thread\(pid=(\d+),name=msedgewebview2,tid=(\d+)/);
      if (waiter) {
        try {
          fs.writeFileSync(path.join(directory, 'waiter-stack.log'), execFileSync(process.env.SIA_STACK_PYTHON, [process.env.SIA_WAITER_SCRIPT, waiter[1], waiter[2]], { windowsHide: true, timeout: 20000 }));
        } catch (captureError) {
          if (captureError.stdout) fs.writeFileSync(path.join(directory, 'waiter-stack.log'), captureError.stdout);
        }
      }
    }
    if (process.env.SIA_HANG_HOLD === '1') {
      console.error(`保留测试现场 60 秒：PID=${child.pid}，${directory}`);
      await delay(60000);
    }
    throw error;
  } finally {
    running = false;
    fs.writeFileSync(path.join(directory, 'native.log'), diagnostics.join(''), 'utf8');
    // 只结束脚本创建的隔离进程树，保留用户正在运行的浏览器。
    if (child.exitCode === null) await new Promise(resolve => {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('exit', resolve);
    });
    if (browser) await browser.close().catch(() => {});
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    console.log(`测试资料：${directory}`);
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
