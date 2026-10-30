/** 真实 WebView2 网页右键菜单回归，独立资料与本地站点，不访问用户网页。 */
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
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<title>Context fixture</title><style>body{padding:30px}iframe{width:600px;height:250px}</style><script>window.identity=Math.random()</script><h1>菜单测试区域</h1><input id="draft" value="保留输入"><a href="/target">链接目标</a>${request.url==='/'?'<iframe src="/frame"></iframe>':''}`);
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
    let menu;
    for (const connection of connections.values()) {
      menu ||= connection.contexts().flatMap(context=>context.pages()).find(page=>page.url().endsWith('/menu.html'));
    }
    assert.ok(menu, '原生浮层应已初始化');
    // 真实鼠标右键必须进入 Sia Menu，而不是操作系统自绘菜单。
    await page.locator('h1').click({button:'right'});
    await menu.locator('.sia-menu').waitFor({timeout:5000});
    assert.ok((await menu.locator('.sia-menu').innerText()).includes('刷新'));
    const payload=await menu.evaluate(()=>window.__TAURI__.core.invoke('get_browser_menu_state'));
    assert.equal(payload.kind,'web-context');
    await menu.waitForFunction(()=>document.hasFocus()); // 原生焦点必须交给菜单，真实 Escape 才能被接收。
    assert.ok(payload.items.some(item=>item.children?.length), '必须保留更多工具子菜单');
    const shadow=await menu.locator('.browser-window-menu').evaluate(el=>getComputedStyle(el).boxShadow);
    assert.ok(shadow.includes('0.06') && shadow.includes('0.1'), '使用统一轻阴影');
    // 在测试窗口补白色底用于展示 CSS 阴影，截图后立即恢复真实透明背景。
    const backdrop=await menu.addStyleTag({content:'html.browser-menu-document,body.browser-menu-document__body{background:#f5f6f8!important}'});
    const bounds=await menu.locator('.browser-window-menu').boundingBox();
    await menu.screenshot({path:require('node:path').join(target,'tmp/web-context-light.png'),clip:{x:bounds.x-20,y:bounds.y-20,width:bounds.width+40,height:bounds.height+40}});
    await backdrop.evaluate(node=>node.remove());
    // 键盘选择跳过禁用项，支持子菜单进出和 Enter 执行。
    await menu.locator('.sia-menu').focus();
    await menu.keyboard.press('ArrowDown');
    assert.equal(await menu.evaluate(()=>document.activeElement.textContent.trim().startsWith('前进')),true);
    await menu.getByRole('button',{name:/^更多工具/}).focus();
    await menu.keyboard.press('ArrowRight');
    await menu.waitForFunction(()=>Boolean(document.activeElement.closest('.sia-menu__popup')));
    await menu.keyboard.press('ArrowLeft');
    assert.ok((await menu.evaluate(()=>document.activeElement.textContent)).includes('更多工具'));
    const before=await page.evaluate(()=>window.identity);
    await menu.getByRole('button',{name:/^刷新/}).focus();
    await menu.keyboard.press('Enter');
    await page.waitForFunction(previous=>window.identity!==previous,before);
    await page.locator('#draft').fill('主页面输入必须保留');
    const mainIdentity=await page.evaluate(()=>window.identity);
    const frame=page.frameLocator('iframe');
    const frameBefore=await frame.locator('body').evaluate(()=>window.identity);
    await frame.locator('h1').click({button:'right'});
    await menu.getByText('刷新框架',{exact:true}).waitFor();
    await menu.getByText('刷新框架',{exact:true}).click();
    for(let i=0;i<50;i++) {
      if(await frame.locator('body').evaluate(()=>window.identity)!==frameBefore) break;
      await delay(100);
    }
    assert.notEqual(await frame.locator('body').evaluate(()=>window.identity),frameBefore);
    assert.equal(await page.evaluate(()=>window.identity),mainIdentity);
    assert.equal(await page.locator('#draft').inputValue(),'主页面输入必须保留');
    // 链接上下文、悬停子菜单和取消后重复打开。
    await page.locator('a').click({button:'right'});
    await menu.locator('.sia-menu').waitFor();
    assert.ok((await menu.locator('.sia-menu').innerText()).includes('链接'));
    await menu.evaluate(()=>window.__TAURI__.core.invoke('close_browser_menu'));
    await page.locator('h1').click({button:'right'});
    await menu.getByText('更多工具',{exact:true}).hover();
    await menu.locator('.sia-menu__popup').waitFor();
    await menu.keyboard.press('Escape');
    await menu.keyboard.press('Escape');
    await main.evaluate(()=>window.__TAURI__.core.invoke('set_browser_theme',{darkMode:true}));
    await page.locator('h1').click({button:'right'});
    await menu.locator('.sia-menu').waitFor();
    assert.equal((await menu.evaluate(()=>window.__TAURI__.core.invoke('get_browser_menu_state'))).darkMode,true);
    await menu.screenshot({path:require('node:path').join(target,'tmp/web-context-dark.png')});
    await menu.keyboard.press('Escape');
    await page.locator('#draft').fill('菜单关闭后继续输入');
    await page.locator('h1').click({button:'right'});
    await menu.locator('.sia-menu').waitFor();
    // 页面自行导航时撤销旧上下文，不能让旧菜单悬挂在新文档之上。
    await page.goto(url+'target');
    await menu.locator('.sia-menu').waitFor({state:'hidden'});
    console.log('PASS 框架轻阴影、真实刷新、iframe 精确刷新、链接菜单、悬停子菜单、取消重开与深色主题');
  } finally {
    if(child.exitCode===null) await new Promise(resolve=>spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('exit',resolve));
    for(const browser of connections.values()) await browser.close().catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
