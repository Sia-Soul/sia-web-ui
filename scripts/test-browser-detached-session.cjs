/** 不启用远程调试端口，验证真实 WebView2 跨窗口共享临时 Cookie 与会话交接。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const target = browserTargetDirectory();
  const directory = path.join(target, 'detached-window-tests', `session-${Date.now()}`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '.sia-startup-test'), 'isolated session transfer', 'utf8');
  const requests = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.url === '/') {
      requests.push(req.headers.cookie ?? '');
      if (requests.length === 1) res.setHeader('Set-Cookie', 'sia_session=fixture; Path=/');
    }
    res.end('<!doctype html><meta charset="UTF-8"><title>会话转移测试</title><h1>独立窗口测试</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(directory, 'browser-state.json'), JSON.stringify({ version: 3, activeId: 'one', verticalPanelPinned: false,
    groups: [{ id: 'a', name: '中文分组', color: '#2867df', smallGroups: [{ id: 's', name: '子组' }] }],
    tabs: [{ id: 'one', title: '第一项', url, groupId: 'a', smallGroupId: 's' }, { id: 'two', title: '第二项', url: '', groupId: 'a', smallGroupId: 's' }, { id: 'remaining', title: '保留页', url: '', groupId: 'group-root' }] }), 'utf8');
  const env = { ...process.env }; delete env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS;
  const processes = [];
  function launch(detach = false) {
    const child = spawn(process.argv[2] || path.join(target, 'release/sia-browser.exe'), ['--diagnostic-data-dir', directory, ...(detach ? ['--diagnostic-detach-group', 'a'] : [])], {
      windowsHide: true, env, stdio: ['ignore', 'ignore', fs.openSync(path.join(directory, 'native.log'), 'a')],
    });
    processes.push(child.pid);
    return child;
  }
  function stop(pid, tree = true) {
    try { execFileSync('taskkill', ['/PID', String(pid), ...(tree ? ['/T'] : []), '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* 测试进程已经退出。 */ }
  }
  async function wait(predicate, description) {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await delay(200); }
    throw new Error(`等待失败：${description}；诊断目录 ${directory}`);
  }
  const child = launch(true);
  try {
    let state;
    for (let i = 0; i < 200; i++) {
      try { state = JSON.parse(fs.readFileSync(path.join(directory, 'browser-state.json'), 'utf8')); } catch { /* 保存过程中的短暂写入。 */ }
      if (state?.tabs.length === 1 && state.tabs[0].id === 'remaining') break;
      await delay(200);
    }
    assert.equal(state.tabs.length, 1, `原窗口应移除分组；诊断目录 ${directory}`);
    assert.equal(requests.length, 1, '拆窗不能再次请求网页');
    const sessions = fs.readdirSync(path.join(directory, 'detached-windows'));
    assert.equal(sessions.length, 1);
    const detached = JSON.parse(fs.readFileSync(path.join(directory, 'detached-windows', sessions[0], 'state.json'), 'utf8'));
    assert.deepEqual(detached.tabs.map(tab => tab.id), ['one', 'two']);
    assert.equal(detached.groups[0].name, '中文分组');
    stop(child.pid);
    await delay(500);
    launch();
    await wait(() => requests.length === 2, '重启后恢复独立会话');
    assert.equal(fs.readdirSync(path.join(directory,'detached-windows')).length,1,'恢复不能重复创建会话');
    console.log('PASS 无调试端口的原生拆组不重载、页签顺序与重启恢复');
  } finally {
    for (const pid of processes) stop(pid);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
