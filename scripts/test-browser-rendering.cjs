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
  const directory = path.join(target, 'rendering-tests', String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '.sia-startup-test'), 'isolated rendering test', 'utf8');
  const server = http.createServer((request, response) => response.end('<!doctype html><title>Rendering fixture</title><style>body{margin:0}#controls{position:fixed;bottom:0;height:35px;background:red;width:100%}</style><div id="controls">Controls</div><script>document.addEventListener("mousemove",()=>document.body.dataset.hover="received")</script>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(directory, 'browser-state.json'), JSON.stringify({version:3,activeId:'render',groups:[],tabs:[{id:'render',title:'Rendering fixture',url,groupId:'group-root',sleeping:false}]}), 'utf8');
  const child = spawn(process.argv[3] || path.join(target,'release/sia-browser.exe'), ['--diagnostic-data-dir',directory], {windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=0 --enable-automation'}});
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
    const session = await pageBrowser.newBrowserCDPSession();
    const {arguments: args} = await session.send('Browser.getBrowserCommandLine');
    assert.ok(args.includes('--disable-gpu-compositing'),'真实网页进程必须启用软件合成兼容参数');
    // 布局命令必须明确标签，不能影响其他后台网页的视口。
    await main.evaluate(()=>window.__TAURI__.core.invoke('set_browser_bounds',{tabId:'render',bounds:{x:296,y:47,width:711,height:1341}}));
    await page.waitForFunction(()=>innerWidth===711&&innerHeight===1341);
    await page.mouse.move(400,900);
    await page.waitForFunction(()=>document.body.dataset.hover==='received');
    assert.equal(await page.locator('#controls').evaluate(e=>e.getBoundingClientRect().bottom),1341);
    console.log('PASS 真实网页进程兼容参数、711×1341 窄高视口、鼠标事件及底部控件布局');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
    for(const browser of connections.values()) await browser.close().catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
