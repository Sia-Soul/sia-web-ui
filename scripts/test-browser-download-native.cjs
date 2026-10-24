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
  const server = http.createServer((request, response) => {
    if(request.url==='/download') {
      response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="fixture.bin"','Content-Length':65536});
      response.write(Buffer.alloc(32768,65));setTimeout(()=>response.end(Buffer.alloc(32768,66)),2000);
    } else if(request.url==='/close') response.end('<!doctype html><title>Closing popup</title><script>setTimeout(()=>window.close(),1000)</script>'); else response.end('<!doctype html><title>Download fixture</title><a id="download" target="_blank" href="/download">Download</a><a id="close" target="_blank" href="/close">Close popup</a>');
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
    await main.evaluate(()=>{window.downloadEvents=[];return window.__TAURI__.event.listen('sia://browser-download',e=>window.downloadEvents.push(e.payload))});
    await main.evaluate(directory=>window.__TAURI__.core.invoke('set_download_preferences',{directory,askBeforeDownload:false}),directory);
    const downloadSession=await pageBrowser.newBrowserCDPSession();
    await downloadSession.send('Browser.setDownloadBehavior',{behavior:'default'});
    await page.locator('#download').click();
    await main.waitForFunction(()=>window.downloadEvents.some(e=>e.state==='started'),null,{timeout:15000}).catch(async e=>{console.log(await main.evaluate(()=>({events:window.downloadEvents,text:document.body.innerText})));for(const b of connections.values())console.log(b.contexts().flatMap(c=>c.pages()).map(p=>p.url()));throw e});
    await delay(500);
    assert.equal(await main.locator('.vertical-tree-compact-item').evaluateAll(es=>new Set(es.map(e=>e.dataset.browserTabId)).size),2,'download popup should leave only original tab');
    assert.deepEqual(await main.locator('.vertical-tree-compact-item:has([aria-current=page])').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.browserTabId))]),['render'],'closing download popup must return to its opener, not old adjacent blank tab');
    await main.waitForFunction(()=>window.downloadEvents.some(e=>e.state==='finished'),null,{timeout:15000});
    const result=await main.evaluate(()=>window.downloadEvents.find(e=>e.state==='finished'));
    assert.equal(result.success,true,'download must survive tab removal');
    assert.equal(fs.statSync(result.filePath).size,65536);
    const menu=await main.evaluate(()=>window.__TAURI__.core.invoke('get_browser_menu_state'));
    assert.equal(menu.kind,'downloads');
    await page.locator('#close').click();
    await delay(2500);
    assert.equal(await main.locator('.vertical-tree-compact-item').evaluateAll(es=>new Set(es.map(e=>e.dataset.browserTabId)).size),2,'script close must remove popup tab');
    await main.evaluate(directory=>window.__TAURI__.core.invoke('set_download_preferences',{directory,askBeforeDownload:true}),directory);
    await page.locator('#download').click();
    await main.waitForFunction(()=>window.downloadEvents.some(e=>e.state==='waiting'));
    await delay(300);
    assert.equal(await main.locator('.vertical-tree-compact-item').evaluateAll(es=>new Set(es.map(e=>e.dataset.browserTabId)).size),2);
    const waiting=await main.evaluate(()=>window.downloadEvents.find(e=>e.state==='waiting'));
    await main.evaluate(id=>window.__TAURI__.core.invoke('resolve_pending_download',{id,choice:'cancel'}),waiting.id);
    await main.waitForFunction(id=>window.downloadEvents.some(e=>e.id===id&&e.state==='finished'&&e.success===false),waiting.id);
    console.log('PASS native popup removal, full download bytes, script close, confirmation and cancellation');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
    for(const browser of connections.values()) await browser.close().catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
