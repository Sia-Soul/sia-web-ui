/** 真实 WebView2 原样拆窗：页面身份、表单、内存、滚动、后台页和窗口隔离。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function ports(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?ports(path.join(dir,e.name)):e.name==='DevToolsActivePort'?[path.join(dir,e.name)]:[]); }
(async()=>{
 const target=browserTargetDirectory(), dir=path.join(target,'detached-window-tests',`live-${Date.now()}`);
 fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'.sia-startup-test'),'live transfer fixture','utf8');
 const loads=new Map(); let finishDownload;
 const server=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(req.url==='/download') {
   res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="transfer.bin"','Content-Length':65536});
   res.write(Buffer.alloc(32768,65));finishDownload=()=>res.end(Buffer.alloc(32768,66));return;
  }
  if(req.url==='/tone.wav') {
   const rate=8000, length=rate*60, wav=Buffer.alloc(44+length*2);
   wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(length*2,40);
   res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':wav.length});res.end(wav);return;
  }
  loads.set(req.url,(loads.get(req.url)||0)+1);
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><meta charset="utf-8"><title>原样迁移测试</title><audio id="media" src="/tone.wav" muted loop></audio><input id="draft"><div style="height:4000px">滚动测试</div><script>window.identity=crypto.randomUUID();window.count=0;setInterval(()=>window.count++,100);</script>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const group={id:'a',name:'迁移分组',color:'#1680ff',smallGroups:[{id:'s',name:'小分组'}]};
 fs.writeFileSync(path.join(dir,'browser-state.json'),JSON.stringify({version:3,downloadDirectory:dir,activeId:'one',verticalPanelPinned:false,groups:[group],tabs:[{id:'one',title:'第一项',url:base+'/one',groupId:'a',smallGroupId:'s'},{id:'two',title:'第二项',url:base+'/two',groupId:'a',smallGroupId:'s'},{id:'remaining',title:'保留页',url:'',groupId:'group-root'}]}),'utf8');
 const child=spawn(process.argv[3]||path.join(target,'release/sia-browser.exe'),['--diagnostic-data-dir',dir],{windowsHide:true,stdio:['ignore','ignore',fs.openSync(path.join(dir,'native.log'),'w')],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=0 --enable-automation'}});
 const connections=new Map();
 async function pages(){
  for(const file of ports(dir)){const port=fs.readFileSync(file,'utf8').split('\n')[0];if(!connections.has(port)){try{connections.set(port,await chromium.connectOverCDP(`http://127.0.0.1:${port}`));}catch{}}}
  return [...connections.values()].flatMap(b=>b.contexts().flatMap(c=>c.pages()));
 }
 async function wait(fn,desc){const end=Date.now()+45000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(200);}throw new Error(`${desc}; ${dir}`);}
 const invoke=(page,cmd,args={})=>page.evaluate(({cmd,args})=>window.__TAURI__.core.invoke(cmd,args),{cmd,args});
 const findShell=async owner=>{for(const p of await pages()){if(p.url()==='http://tauri.localhost/'&&await p.evaluate(()=>window.__TAURI__?.window?.getCurrentWindow().label).catch(()=>null)===owner)return p;}};
 try{
  const main=await wait(()=>findShell('main'),'主外壳启动');
  const one=await wait(async()=>(await pages()).find(p=>p.url()===base+'/one'),'第一个网页启动');
  await invoke(main,'open_browser_tab',{tabId:'two',groupId:'a',smallGroupId:'s',profileGroupId:null,url:base+'/two',bounds:{x:60,y:46,width:900,height:600}});
  const two=await wait(async()=>(await pages()).find(p=>p.url()===base+'/two'),'后台页启动');
  await invoke(main,'switch_browser_tab',{tabId:'one',groupId:'a',smallGroupId:'s',profileGroupId:null,bounds:{x:60,y:46,width:900,height:600}});
  for(const p of [one,two]) await p.evaluate(()=>{document.querySelector('#draft').value='未提交的中文内容';window.scrollTo(0,500);window.unsaved={nested:[1,2,3]};});
  await one.evaluate(async()=>{const audio=document.querySelector('#media');if(audio.readyState<1)await new Promise(r=>audio.addEventListener('loadedmetadata',r,{once:true}));audio.currentTime=12;await audio.play();});
  await one.waitForFunction(()=>document.querySelector('#media').currentTime>=12);
  // 用一个无法导航的活动页触发接收失败，后台网页必须退回且不覆盖源活动页。
  const rollbackState={version:3,activeId:'bad',groups:[group],tabs:[{id:'two',url:base+'/two',groupId:'a',smallGroupId:'s'},{id:'bad',url:'invalid://fixture',groupId:'a',smallGroupId:'s'}]};
  await assert.rejects(()=>invoke(main,'detach_browser_window',{state:rollbackState,sourceActiveId:'one',position:null}),/协议|invalid/);
  assert.deepEqual((await invoke(main,'transferred_browser_tabs')).sort(),['one','two']);
  const before=await Promise.all([one,two].map(p=>p.evaluate(()=>({identity:window.identity,count:window.count,scroll:scrollY}))));
  await invoke(main,'set_download_preferences',{directory:dir,askBeforeDownload:false});
  const downloadSession=await one.context().browser().newBrowserCDPSession();await downloadSession.send('Browser.setDownloadBehavior',{behavior:'default'});
  await one.evaluate(()=>{const link=document.createElement('a');link.href='/download';document.body.append(link);link.click();});
  await main.waitForFunction(()=>Boolean(document.querySelector('.browser-download-action.is-active')));
  await main.evaluate(()=>window.__TAURI__.core.invoke('floating_tab_panel_action',{action:{action:'detach',value:JSON.stringify({item:{kind:'group',groupId:'a'},position:[350,250]})}}));
  const targetShell=await wait(async()=>{for(const p of await pages()){if(p!==main&&p.url()==='http://tauri.localhost/'&&await p.evaluate(()=>!!window.__SIA_LIVE_TRANSFER__).catch(()=>false))return p;}},'新外壳启动');
  await wait(async()=>{const state=await invoke(main,'load_browser_state');return state?.tabs.length===1&&state.tabs[0].id==='remaining';},'源窗口完成交接');
  for(let i=0;i<2;i++){
   const after=await [one,two][i].evaluate(()=>({identity:window.identity,count:window.count,scroll:scrollY,draft:document.querySelector('#draft').value,unsaved:window.unsaved}));
   assert.equal(after.identity,before[i].identity,'必须保留同一 Document');assert.equal(after.draft,'未提交的中文内容');assert.deepEqual(after.unsaved,{nested:[1,2,3]});assert.ok(after.count>before[i].count);assert.equal(after.scroll,before[i].scroll);
  }
  const media=await one.evaluate(()=>({time:document.querySelector('#media').currentTime,paused:document.querySelector('#media').paused}));
  assert.ok(media.time>12,'媒体进度不能重置');assert.equal(media.paused,false,'媒体应继续播放');
  assert.equal(loads.get('/one'),1);assert.equal(loads.get('/two'),1,'后台页也不能重载');
  assert.deepEqual((await invoke(targetShell,'transferred_browser_tabs')).sort(),['one','two']);
  finishDownload();
  await wait(async()=>{const state=await invoke(targetShell,'load_browser_state');return state?.downloads?.some(d=>d.fileName==='transfer.bin'&&d.state==='finished'&&d.success);},'迁移后下载完成');
  assert.equal(fs.statSync(path.join(dir,'transfer.bin')).size,65536);
  // 监听两个窗口的面板与扩展上下文，验证原生事件不会跨窗口广播。
  const shellOwner=await targetShell.evaluate(()=>window.__TAURI__.window.getCurrentWindow().label);
  const panelPages=(await pages()).filter(p=>p.url().includes('tab-panel.html'));
  const findPanel=async owner=>{for(const p of panelPages)if(await p.evaluate(()=>window.__TAURI__.window.getCurrentWindow().label)===owner)return p;};
  const rootPanel=await findPanel('main'), childPanel=await findPanel(shellOwner);
  for(const p of [rootPanel,childPanel,main,targetShell]) await p.evaluate(async()=>{window.observed=[];const opts={target:{kind:'Webview',label:window.__TAURI__.webview.getCurrentWebview().label}};await window.__TAURI__.event.listen('sia://floating-tab-panel-state',e=>window.observed.push(e.payload.marker),opts);await window.__TAURI__.event.listen('sia://extension-context-changed',e=>window.observed.push(e.payload.heading),opts);});
  const panelState=await invoke(main,'get_floating_tab_panel_state');
  await invoke(main,'update_floating_tab_panel',{payload:{...panelState,marker:'root-only'}});
  await invoke(main,'update_browser_extension_context',{extensionScope:{groupId:'a',smallGroupId:null},heading:'root-context'});
  await delay(200);
  assert.ok((await rootPanel.evaluate(()=>window.observed)).includes('root-only'));
  assert.deepEqual(await childPanel.evaluate(()=>window.observed),[]);
  assert.deepEqual(await targetShell.evaluate(()=>window.observed),[]);
  // 源窗口的延迟关闭与尺寸更新不能再影响已迁移页面。
  await invoke(main,'close_browser_tab',{tabId:'one'});
  await invoke(main,'set_browser_bounds',{bounds:{x:1,y:1,width:10,height:10}});
  assert.equal(await one.evaluate(()=>window.identity),before[0].identity);
  await invoke(targetShell,'switch_browser_tab',{tabId:'two',groupId:'a',smallGroupId:'s',profileGroupId:null,bounds:{x:60,y:46,width:900,height:600}});
  await invoke(main,'browser_window_action',{action:'close'});
  await delay(500);
  assert.equal(await one.evaluate(()=>document.querySelector('#draft').value),'未提交的中文内容');
  assert.equal(await two.evaluate(()=>window.identity),before[1].identity);
  // 再从新窗口拆出单页，回调与归属必须随第二次迁移更新。
  await targetShell.evaluate(()=>window.__TAURI__.core.invoke('floating_tab_panel_action',{action:{action:'detach',value:JSON.stringify({item:{kind:'tab',tabId:'two'},position:[500,300]})}}));
  await wait(async()=>{const state=await invoke(targetShell,'load_browser_state');return state?.tabs.length===1&&state.tabs[0].id==='one';},'再次拆窗');
  assert.equal(await two.evaluate(()=>window.identity),before[1].identity);
  assert.equal(loads.get('/two'),1);
  // 在二次迁移的网页中打开弹窗，再迁移弹窗本身，window.close 必须仍可关闭页签。
  await two.evaluate(()=>window.open('/popup','_blank'));
  let popupId, secondShell;
  await wait(async()=>{for(const p of await pages()){if(p.url()!=='http://tauri.localhost/'||p===targetShell)continue;const state=await invoke(p,'load_browser_state').catch(()=>null);const popup=state?.tabs.find(t=>t.url===base+'/popup');if(popup){popupId=popup.id;secondShell=p;return true;}}},'迁移后的网页打开弹窗');
  const popup=await wait(async()=>(await pages()).find(p=>p.url()===base+'/popup'),'弹窗页面启动');
  await secondShell.evaluate(tabId=>window.__TAURI__.core.invoke('floating_tab_panel_action',{action:{action:'detach',value:JSON.stringify({item:{kind:'tab',tabId},position:[650,350]})}}),popupId);
  let popupShell;
  await wait(async()=>{for(const p of await pages()){if(p.url()!=='http://tauri.localhost/'||p===targetShell||p===secondShell)continue;const state=await invoke(p,'load_browser_state').catch(()=>null);if(state?.tabs.some(t=>t.id===popupId)){popupShell=p;return true;}}},'弹窗交接');
  await wait(async()=>(await invoke(secondShell,'load_browser_state')).tabs.every(t=>t.id!==popupId),'弹窗源移除');
  await popup.evaluate(()=>window.close());
  await wait(async()=>(await invoke(popupShell,'load_browser_state')).tabs.every(t=>t.id!==popupId),'迁移后弹窗自关闭');
  // 主窗口关闭后系统入口仍应由存活窗口接收，不丢网址。
  const forwarded=spawn(process.argv[3]||path.join(target,'release/sia-browser.exe'),['--diagnostic-data-dir',dir,'--open-url',base+'/external'],{windowsHide:true,stdio:'ignore'});
  await new Promise(r=>forwarded.on('exit',r));
  await wait(async()=>(await invoke(targetShell,'load_browser_state')).tabs.some(t=>t.url===base+'/external'),'主窗口关闭后的系统网址转发');
  console.log('PASS 原生整组及再次单页拆窗：Document、中文表单、JS 内存、滚动、媒体播放、后台页保留，失败回滚、面板/扩展事件隔离、原窗口关闭、进行中的下载完成、弹窗自关闭、系统入口转发');
 }finally{
  if(child.exitCode===null)await new Promise(r=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',r));
  for(const b of connections.values())await b.close().catch(()=>{});
  server.closeAllConnections();await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
