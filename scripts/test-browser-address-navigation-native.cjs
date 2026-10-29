/** 真实 WebView2 地址栏导航回归，使用独立资料与本地慢响应服务。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function ports(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? ports(file) : entry.name === 'DevToolsActivePort' ? [file] : [];
  });
}
(async () => {
  const target = browserTargetDirectory();
  const directory = path.join(target, 'download-tests', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '.sia-startup-test'), 'isolated rendering test', 'utf8');
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    if (request.url === '/pending') setTimeout(() => response.end('<title>Pending</title>Pending'), 8000);
    else if (request.url === '/slow') setTimeout(() => response.end('<title>New destination</title>New destination'), 2500);
    else if (request.url === '/redirect') response.writeHead(302, { Location: '/slow' }).end();
    else if (request.url === '/broken') request.socket.destroy();
    else response.end('<title>Old page</title>Old page');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(directory, 'browser-state.json'), JSON.stringify({version:3,downloadDirectory:directory,activeId:'render',verticalPanelPinned:false,groups:[{id:'group-root',name:'Tests',smallGroups:[],color:'#1680ff'}],tabs:[{id:'render',title:'Rendering fixture',url,groupId:'group-root',sleeping:false},{id:'old-download',title:'Old download blank',url:'about:blank',groupId:'group-root',sleeping:false}]}), 'utf8');
  const child = spawn(process.argv[3] || path.join(target,'release/sia-browser.exe'), ['--diagnostic-data-dir',directory], {windowsHide:true,stdio:['ignore','ignore',fs.openSync(path.join(directory,'native.log'),'w')],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=0 --enable-automation'}});
  const connections = new Map();
  try {
    let main, page, pageBrowser;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline && !page) {
      for (const file of ports(directory)) {
        const port = fs.readFileSync(file,'utf8').split('\n')[0];
        if (!connections.has(port)) {
          try { connections.set(port,await chromium.connectOverCDP(`http://127.0.0.1:${port}`)); } catch { continue; }
        }
        const browser = connections.get(port);
        for (const candidate of browser.contexts().flatMap(context=>context.pages())) {
          if (candidate.url()==='http://tauri.localhost/') main=candidate;
          if (candidate.url()===url) {page=candidate;pageBrowser=browser;}
        }
      }
      if (!page) await delay(250);
    }
    assert.ok(main && page,'外壳与隔离网页均应启动');
    await main.evaluate(() => { window.navigationEvents=[]; return window.__TAURI__.event.listen('sia://browser-event', e=>window.navigationEvents.push({kind:e.payload.kind,url:e.payload.url,loading:e.payload.loading})); });
    const input=main.getByRole('textbox',{name:'地址和搜索栏'});
    // 复用已存在的 WebView 导航，覆盖正常页与内核错误页两种起点。
    for (const origin of ['/pending', '/', '/broken']) {
      if (origin === '/pending') {
        await input.fill(url+'pending'); await input.press('Enter');
        await delay(150);
      }
      if (origin === '/broken') {
        await input.fill(url+'broken'); await input.press('Enter');
        await delay(2000);
        assert.equal(await input.inputValue(), url+'broken', '导航失败也必须保留用户提交的地址');
      }
      await input.fill(url+'slow'); await input.press('Enter');
      await delay(500);
      assert.ok(requests.includes('/slow'), '回车必须将新地址提交给内核');
      assert.equal(await input.inputValue(), url+'slow', '等待新页面时地址不能回退');
      assert.equal(await main.getByRole('button',{name:'停止加载',exact:true}).count(),1,'请求未完成时必须显示加载状态');
      await main.getByRole('button',{name:'重新加载',exact:true}).waitFor();
      assert.equal(await page.locator('body').innerText(), 'New destination', '新页面必须实际加载完成');
      requests.length=0;
    }
    // 重定向沿用同一编号更新地址，hash 跳转不应重新进入加载态。
    await input.fill(url+'redirect'); await input.press('Enter');
    await delay(500);
    assert.equal(await input.inputValue(), url+'slow');
    assert.equal(await main.getByRole('button',{name:'停止加载',exact:true}).count(),1);
    await main.getByRole('button',{name:'重新加载',exact:true}).waitFor();
    await page.evaluate(() => { location.hash = 'section'; });
    await main.waitForFunction(target => document.querySelector('input[aria-label="地址和搜索栏"]')?.value === target, url+'slow#section');
    assert.equal(await main.getByRole('button',{name:'停止加载',exact:true}).count(),0);
    console.log('PASS 复用网页与错误页导航：新地址提交、等待期间地址不回退且保持 loading、完成后停止 loading');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
    for(const browser of connections.values()) await browser.close().catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
