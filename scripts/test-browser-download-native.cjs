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
    // 限速且支持 Range 的虚构下载，用真实 WebView2 验证暂停/继续，不访问用户文件。
    if(request.url==='/slow') {
      const total=4*1024*1024;
      let sent=Number((request.headers.range || '').match(/bytes=(\d+)/)?.[1] || 0);
      response.writeHead(sent?206:200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="slow.bin"','Content-Length':total-sent,'Accept-Ranges':'bytes','ETag':'"fixture-v1"',...(sent?{'Content-Range':`bytes ${sent}-${total-1}/${total}`}:{})});
      const timer=setInterval(()=>{const size=Math.min(65536,total-sent);response.write(Buffer.alloc(size,65));sent+=size;if(sent===total){clearInterval(timer);response.end();}},100);
      response.on('close',()=>clearInterval(timer));
    } else if(request.url==='/download') {
      response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="fixture.bin"','Content-Length':65536});
      response.write(Buffer.alloc(32768,65));setTimeout(()=>response.end(Buffer.alloc(32768,66)),2000);
    } else if(request.url==='/unknown') {
      response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="unknown.bin"'});
      response.write(Buffer.alloc(1024,67));setTimeout(()=>response.end(Buffer.alloc(1024,68)),100);
    } else if(request.url==='/close') response.end('<!doctype html><title>Closing popup</title><script>setTimeout(()=>window.close(),1000)</script>'); else response.end('<!doctype html><title>Download fixture</title><a id="download" target="_blank" href="/download">Download</a><a id="unknown" target="_blank" href="/unknown">Unknown size</a><a id="close" target="_blank" href="/close">Close popup</a>');
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
    // 句柄释放后仍能补取终态，前端漏掉完成事件时必须恢复完成按钮和工具栏。
    const finalSnapshot = await main.evaluate(id => window.__TAURI__.core.invoke('get_browser_download_states', { ids: [id] }), result.id);
    assert.equal(finalSnapshot[0].state, 'finished');
    assert.equal(finalSnapshot[0].success, true);
    assert.equal(finalSnapshot[0].filePath, result.filePath);

    await main.locator('.browser-download-action.is-active').waitFor({state:'hidden'});
    assert.equal(await main.evaluate(id=>window.downloadEvents.filter(e=>e.id===id).at(-1).state,result.id),'finished','terminal event must remain the last state');
    // 未提供 Content-Length 的下载也必须根据内核完成状态停止转圈。
    await page.locator('#unknown').click();
    await main.waitForFunction(()=>window.downloadEvents.some(e=>e.fileName==='unknown.bin'&&e.state==='finished'));
    const unknown=await main.evaluate(()=>window.downloadEvents.find(e=>e.fileName==='unknown.bin'&&e.state==='finished'));
    assert.equal(unknown.success,true);
    assert.equal(fs.statSync(unknown.filePath).size,2048);
    await main.locator('.browser-download-action.is-active').waitFor({state:'hidden'});
    // 状态保存有防抖，下面通过同一命令等待最终持久化，避免以事件到达冒充列表收尾。
    const savedDeadline = Date.now() + 5000;
    let savedCompleted = false;
    while (Date.now() < savedDeadline && !savedCompleted) {
      const saved = await main.evaluate(() => window.__TAURI__.core.invoke('load_browser_state'));
      savedCompleted = saved.downloads?.some(e => e.id === unknown.id && e.state === 'finished' && e.success);
      if (!savedCompleted) await delay(100);
    }
    assert.equal(savedCompleted, true, '原生完成状态必须保存到会话');
    // 浮层外观和保持打开由 download-controls 回归验证，此处不依赖桌面焦点。
    // 保留现有标签作为下载发起页，暂停不能成为 finished，也不能释放该任务的原生句柄。
    await page.evaluate(() => { const link=document.createElement('a');link.id='slow';link.href='/slow';link.textContent='slow';document.body.append(link); });
    await page.locator('#slow').click();
    await main.waitForFunction(()=>window.downloadEvents.some(e=>e.sourceUrl?.endsWith('/slow')&&e.receivedBytes>0));
    const slow=await main.evaluate(()=>window.downloadEvents.find(e=>e.sourceUrl?.endsWith('/slow')));
    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'pause'}),slow.id);
    await main.waitForFunction(id=>window.downloadEvents.filter(e=>e.id===id).at(-1)?.paused===true,slow.id);
    await delay(300);
    const pausedBytes=await main.evaluate(id=>window.downloadEvents.filter(e=>e.id===id).at(-1).receivedBytes,slow.id);
    await delay(700);
    assert.equal(await main.evaluate(id=>window.downloadEvents.filter(e=>e.id===id).at(-1).receivedBytes,slow.id),pausedBytes);
    assert.equal(await main.evaluate(id=>window.downloadEvents.some(e=>e.id===id&&e.state==='finished'),slow.id),false);
    const pausedSnapshot = await main.evaluate(id => window.__TAURI__.core.invoke('get_browser_download_states', { ids: [id] }), slow.id);
    assert.equal(pausedSnapshot[0].paused, true);
    assert.notEqual(pausedSnapshot[0].state, 'finished', '核对状态不能把暂停当作终态');

    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'resume'}),slow.id);
    await main.waitForFunction(id=>window.downloadEvents.some(e=>e.id===id&&e.state==='finished'&&e.success),slow.id,{timeout:20000});
    const completed=await main.evaluate(id=>window.downloadEvents.filter(e=>e.id===id).at(-1),slow.id);
    assert.equal(fs.statSync(completed.filePath).size,4*1024*1024);
    await page.locator('#slow').click();
    await main.waitForFunction(id=>window.downloadEvents.some(e=>e.sourceUrl?.endsWith('/slow')&&e.id!==id),slow.id);
    const cancelId=await main.evaluate(()=>window.downloadEvents.filter(e=>e.sourceUrl?.endsWith('/slow')).at(-1).id);
    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'cancel'}),cancelId);
    await main.waitForFunction(id=>window.downloadEvents.some(e=>e.id===id&&e.state==='finished'&&e.cancelled),cancelId);
    // 通过业务入口重试原始地址，产生新任务编号并再次收到原生下载事件。
    await main.evaluate(id=>window.__TAURI__.core.invoke('browser_menu_action',{action:{action:`panel|downloads|retry|${id}`}}),cancelId);
    await main.waitForFunction(ids=>window.downloadEvents.some(e=>e.sourceUrl?.endsWith('/slow')&&!ids.includes(e.id)),[slow.id,cancelId],{timeout:15000});
    const retryId=await main.evaluate(()=>window.downloadEvents.filter(e=>e.sourceUrl?.endsWith('/slow')).at(-1).id);
    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'cancel'}),retryId);
    await main.waitForFunction(id=>window.downloadEvents.some(e=>e.id===id&&e.cancelled),retryId);
    await page.locator('#close').click();
    await delay(2500);
    assert.equal(await main.locator('.vertical-tree-compact-item').evaluateAll(es=>new Set(es.map(e=>e.dataset.browserTabId)).size),2,'script close must remove popup tab');
    await main.evaluate(directory=>window.__TAURI__.core.invoke('set_download_preferences',{directory,askBeforeDownload:true}),directory);
    await page.locator('#download').click();
    await main.waitForFunction(()=>window.downloadEvents.some(e=>e.state==='waiting'));
    await delay(300);
    assert.equal(await main.locator('.vertical-tree-compact-item').evaluateAll(es=>new Set(es.map(e=>e.dataset.browserTabId)).size),2);
    const waiting=await main.evaluate(()=>window.downloadEvents.find(e=>e.state==='waiting'));
    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'pause'}),waiting.id);
    await main.waitForFunction(id=>window.downloadEvents.filter(e=>e.id===id).at(-1)?.paused===true,waiting.id);
    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'resume'}),waiting.id);
    await main.waitForFunction(id=>window.downloadEvents.filter(e=>e.id===id).at(-1)?.paused===false,waiting.id);
    await main.evaluate(id=>window.__TAURI__.core.invoke('control_browser_download',{id,action:'cancel'}),waiting.id);
    await main.waitForFunction(id=>window.downloadEvents.some(e=>e.id===id&&e.state==='finished'&&e.success===false),waiting.id);
    assert.equal(await main.evaluate(id=>window.downloadEvents.filter(e=>e.id===id).at(-1).cancelled,waiting.id),true);
    console.log('PASS pause/resume/cancel/retry, native popup removal, known/unknown size completion, toolbar stops, persisted completion, script close, confirmation and cancellation');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
    for(const browser of connections.values()) await browser.close().catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
