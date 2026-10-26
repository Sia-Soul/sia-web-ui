// 启动真实打包 EXE，通过 WebView2 调试协议验证壳层和原生命令；资料仅写入新建的测试目录。
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const assert = require('node:assert/strict');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const limit = (promise, ms, label) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms);
  })]).finally(() => clearTimeout(timer));
};
async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function run() {
  const root = path.resolve(__dirname, '..');
  // 临时浏览器资料也随构建输出迁移，避免回归测试继续消耗源码盘空间。
  const target = browserTargetDirectory();
  const executable = process.argv[2] ? path.resolve(process.argv[2]) : path.join(target, 'release/sia-browser.exe');
  const directory = path.join(target, 'startup-tests', `browser-startup-${Date.now()}`);
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  let fixtureRequests = 0;
  const server = http.createServer((_, response) => {
    fixtureRequests++;
    response.end('<!doctype html><title>Sia Startup Fixture</title><h1>startup fixture</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fixtureUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    for (const phase of ['cold', 'restored']) {
      const debugPort = await port();
      const child = spawn(executable, ['--diagnostic-data-dir', directory], {
        windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}` },
      });
      // 仅记录隔离夹具的运行日志，失败时保留等待链，不采集真实用户网页或凭据。
      const diagnostics = [];
      child.stderr.on('data', data => diagnostics.push(data.toString('utf8')));
      let browser;
      let phaseActive = true;
      let restoreFixture;
      try {
        const endpoint = `http://127.0.0.1:${debugPort}`;
        await limit((async () => {
          while (true) {
            try { if ((await fetch(`${endpoint}/json/version`)).ok) return; } catch {}
            if (child.exitCode !== null) throw new Error(`浏览器提前退出：${child.exitCode}`);
            await delay(200);
          }
        })(), 20000, `${phase}: WebView2 启动`);
        browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 });
        execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'probe-browser-test-window.ps1'), '-TestProcessId', String(child.pid), '-Show'], { windowsHide: true, timeout: 10000 });
        let main;
        await limit((async () => {
          while (!(main = browser.contexts().flatMap(context => context.pages()).find(page => /tauri\.localhost\/?$|tauri\.localhost\/index.html/.test(page.url())))) {
            if (child.exitCode !== null) throw new Error('浏览器已退出');
            await delay(100);
          }
        })(), 10000, `${phase}: 主壳层`);
        // 同步原生命令必须穿过实际 UI 线程；仅检查 DOM 会遗漏原生线程死锁。
        const label = await limit(main.evaluate(() => window.__TAURI__.core.invoke('current_window_label')), 5000, `${phase}: 原生线程响应`);
        assert.equal(label, 'main');
        await main.locator('.browser-toolbar__navigation').waitFor({ state: 'attached', timeout: 15000 });
        const state = await limit((async () => {
          while (true) {
            const value = await main.evaluate(() => window.__TAURI__.core.invoke('get_floating_tab_panel_state'));
            if (value?.tabs?.length) return value;
            await delay(100);
          }
        })(), 10000, `${phase}: 标签面板状态与原生线程`);
        // 恢复期间快速切换不同隔离空间，覆盖创建 WebView 时侧栏继续发送 IPC 的重入路径。
        if (phase === 'restored' && process.env.SIA_STARTUP_SWITCH_STRESS === '1') {
          for (let index = 0; index < 24; index++) {
            await limit(main.evaluate(id => window.__TAURI__.core.invoke('floating_tab_panel_action', {
              action: { action: 'select', value: id },
            }), `restore-${index % 6}`), 4000, '恢复期间切换页签');
            await delay(100);
          }
          await limit(main.evaluate(() => window.__TAURI__.core.invoke('floating_tab_panel_action', {
            action: { action: 'select', value: 'startup-fixture' },
          })), 4000, '恢复到初始页签');
        }
        if (phase === 'restored') {
          // 小分组使用独立 WebView2 环境，不能假定其页面属于壳层的 CDP 端口。
          // 本地服务器命中加原生标题回传共同验证网页已实际加载。
          await limit((async () => {
            while (phaseActive) {
              const current = await main.evaluate(() => window.__TAURI__.core.invoke('get_floating_tab_panel_state'));
              if (fixtureRequests > 0 && current?.tabs?.some(tab => tab.id === 'startup-fixture' && tab.title === 'Sia Startup Fixture' && !tab.loading)) return;
              await delay(200);
            }
          })(), 20000, '恢复真实网页');
        }
        // 连续检查 IPC，覆盖初始渲染之后的布局、焦点和面板更新。
        for (let index = 0; index < 20; index++) {
          assert.equal(await limit(main.evaluate(() => window.__TAURI__.core.invoke('current_window_label')), 2000, '持续响应'), 'main');
          await delay(250);
        }
        execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'probe-browser-test-window.ps1'), '-TestProcessId', String(child.pid)], { windowsHide: true, timeout: 10000 });
        if (phase === 'cold') {
          const persisted = {
            tabs: [{ id: 'startup-fixture', title: '等待恢复', url: fixtureUrl, groupId: 'group-local', smallGroupId: 'local-admin', loading: false, hasWebview: false, sleeping: true },
              ...(process.env.SIA_STARTUP_SWITCH_STRESS === '1' ? Array.from({ length: 6 }, (_, index) => ({
                id: `restore-${index}`, title: `恢复页 ${index}`, url: fixtureUrl, groupId: 'group-local',
                smallGroupId: ['local-admin', 'local-brand', 'local-partner'][index % 3], sleeping: true,
              })) : [])],
            groups: state.groups, activeId: 'startup-fixture', panelPinned: true,
          };
          await limit(main.evaluate(value => window.__TAURI__.core.invoke('save_browser_state', { state: value }), persisted), 5000, '保存恢复场景');
          restoreFixture = persisted;
        }
        console.log(`PASS ${phase}: 原生线程、工具栏、标签面板及 20 次持续响应${phase === 'restored' ? '、真实网页恢复' : ''}`);
      } catch (error) {
        fs.writeFileSync(path.join(directory, `${phase}-native.log`), diagnostics.join(''), 'utf8');
        try {
          const probe = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'inspect-browser-hang.ps1'), '-BrowserProcessId', String(child.pid)], { windowsHide: true, timeout: 12000 });
          fs.writeFileSync(path.join(directory, `${phase}-wait-chain.log`), probe);
        } catch (probeError) {
          if (probeError.stdout) fs.writeFileSync(path.join(directory, `${phase}-wait-chain.log`), probeError.stdout);
        }
        console.error(`诊断日志：${directory}`);
        throw error;
      } finally {
        phaseActive = false;
        // 仅清理本次测试创建的进程树；绝不按进程名结束用户实例。
        if (child.exitCode === null) await new Promise(resolve => {
          spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('exit', resolve);
        });
        if (browser) await browser.close().catch(() => {});
        await delay(700);
        // 停止测试实例后再固定下一轮资料，防止本轮自动保存覆盖人工写入的恢复夹具。
        if (restoreFixture) fs.writeFileSync(path.join(directory, 'browser-state.json'), JSON.stringify(restoreFixture), 'utf8');
      }
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
