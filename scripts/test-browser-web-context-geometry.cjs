/** 真实 WebView2 右键菜单几何回归：核对屏幕点击位置与 Win32 子菜单裁剪区域，使用独立资料。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
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
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<title>Context fixture</title><style>body{padding:30px}iframe{width:600px;height:250px}</style><script>window.identity=Math.random()</script><h1>菜单测试区域</h1><input id="draft" value="保留输入"><a href="/target">链接目标</a>${request.url==='/'?'<iframe src="/frame"></iframe>':''}`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(directory, 'browser-state.json'), JSON.stringify({version:3,downloadDirectory:directory,activeId:'render',verticalPanelPinned:false,groups:[{id:'group-root',name:'Tests',smallGroups:[],color:'#1680ff'}],tabs:[{id:'render',title:'Rendering fixture',url,groupId:'group-root',sleeping:false},{id:'old-download',title:'Old download blank',url:'about:blank',groupId:'group-root',sleeping:false}]}), 'utf8');
  const child = spawn(process.argv[3] || path.join(target,'release/sia-browser.exe'), ['--diagnostic-data-dir',directory,'--diagnostic-visible'], {windowsHide:true,stdio:['ignore','ignore',fs.openSync(path.join(directory,'native.log'),'w')],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=0 --enable-automation'}});
  const connections = new Map();
  try {
    let main, page;
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
          if (candidate.url()===url) {page=candidate;}
        }
      }
      if (!page) await delay(250);
    }
    assert.ok(main && page,'外壳与隔离网页均应启动');
    let menu;
    for (const connection of connections.values()) {
      menu ||= connection.contexts().flatMap(context=>context.pages()).find(page=>page.url().endsWith('/menu.html'));
    }
    assert.ok(menu, '原生浮层应已初始化');
    const failures = [];
    await page.bringToFront();
    await page.waitForLoadState();
    await page.evaluate(()=>document.addEventListener('contextmenu',e=>window.lastContext={screenX:e.screenX,screenY:e.screenY,clientX:e.clientX,clientY:e.clientY},true));
    const owner = await main.evaluate(async()=>{
      const w=window.__TAURI__.window.getCurrentWindow();
      return {position:await w.innerPosition(),size:await w.innerSize(),scale:await w.scaleFactor()};
    });
    for (const point of [{x:100,y:80},{x:300,y:80},{x:600,y:400}]) {
      await page.bringToFront();
      await page.mouse.click(point.x,point.y,{button:'right'});
      await menu.locator('.sia-menu').waitFor({timeout:5000});
      await delay(300);
      const click=await page.evaluate(()=>window.lastContext);
      const geometry=await menu.evaluate(async()=>{
        const w=window.__TAURI__.window.getCurrentWindow();
        const r=document.querySelector('.browser-window-menu').getBoundingClientRect();
        return {scale:await w.scaleFactor(),position:await w.innerPosition(),size:await w.innerSize(),rect:{x:r.x,y:r.y,width:r.width,height:r.height},screen:{x:screenX,y:screenY},viewport:{w:innerWidth,h:innerHeight},payload:await window.__TAURI__.core.invoke('get_browser_menu_state')};
      });
      // 窗口边缘允许避让，阴影留白为 20 CSS px；非边缘点击应紧贴光标。
      const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);
      const expected={
        x:clamp(click.screenX,owner.position.x/owner.scale+20,(owner.position.x+owner.size.width)/owner.scale-geometry.payload.menuLayout.width-20),
        y:clamp(click.screenY,owner.position.y/owner.scale+20,(owner.position.y+owner.size.height)/owner.scale-geometry.payload.menuLayout.height-20),
      };
      const offset = {x:geometry.position.x/geometry.scale+geometry.rect.x-expected.x,y:geometry.position.y/geometry.scale+geometry.rect.y-expected.y};
      console.log(JSON.stringify({point,offset,scale:geometry.scale}));
      if (Math.abs(offset.x)>2 || Math.abs(offset.y)>2) failures.push(`右键菜单偏移 ${JSON.stringify(offset)}`);
      // 复用窗口后先离开旧悬停位置，保证 CDP 产生新的 pointerenter。
      await menu.mouse.move(1,1);
      await menu.getByText('更多工具',{exact:true}).hover();
      await menu.locator('.sia-menu__popup').waitFor({timeout:5000});
      await delay(500);
      const popup = await menu.locator('.sia-menu__popup').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,viewport:innerWidth}});
      console.log('POPUP', JSON.stringify(popup));
      // 原生窗口裁剪在截图之外生效，直接询问 Win32 区域是否包含子菜单四边中点。
      const probe = spawnSync('python', ['scripts/test-browser-native-menu-region.py', JSON.stringify({pid:child.pid,geometry,popup})], {encoding:'utf8'});
      assert.equal(probe.status,0,probe.stderr);
      console.log('NATIVE',probe.stdout.trim());
      if (!JSON.parse(probe.stdout).covered) failures.push('子菜单裁剪区域未覆盖完整表面');
      await menu.evaluate(()=>window.__TAURI__.core.invoke('close_browser_menu'));
      await menu.locator('.sia-menu').waitFor({state:'hidden'});
    }
    assert.deepEqual(failures, [], '右键定位和子菜单原生区域应正确');
    console.log('PASS 点击坐标与菜单对齐，子菜单完整位于原生绘制区域内');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
    for(const browser of connections.values()) await browser.close().catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
