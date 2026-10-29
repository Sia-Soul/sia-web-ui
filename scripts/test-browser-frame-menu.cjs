/** 真实 WebView2 菜单：刷新同源、跨源、同 URL 兄弟及嵌套 iframe，不重载主文档。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(read, label) {
  for (let i = 0; i < 100; i++) { const result = await read(); if (result) return result; await delay(100); }
  throw new Error(`等待超时：${label}`);
}
(async () => {
  const dir = path.join(browserTargetDirectory(), 'frame-menu-tests', String(Date.now()));
  fs.mkdirSync(dir, { recursive: true });
  let port;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const content = req.url === '/' ? `<h1>主页面</h1><input id="draft"><iframe id="a" src="/frame"></iframe><iframe id="b" src="/frame"></iframe><iframe id="cross" src="http://localhost:${port}/nested"></iframe>`
      : req.url === '/nested' ? '<h2>外层</h2><iframe src="/frame"></iframe>' : '<h2 id="hit">框架内容</h2><input>';
    res.end(`<style>iframe{width:450px;height:250px}body{margin:10px}</style><script>window.identity=Math.random()</script>${content}`);
  });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  port = server.address().port;
  const child = spawn(path.join(browserTargetDirectory(), 'release/browser-frame-menu-probe.exe'), [`http://127.0.0.1:${port}/`, dir], {
    windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=0' },
  });
  let browser;
  let log = '';
  child.stderr.on('data', data => { log += data.toString(); });
  const findPort = root => fs.readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? findPort(path.join(root, e.name)) : e.name === 'DevToolsActivePort' ? [path.join(root, e.name)] : []);
  try {
    const portFile = await wait(() => findPort(dir)[0], '调试端口');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${fs.readFileSync(portFile, 'utf8').split('\n')[0]}`);
    const page = await wait(() => browser.contexts().flatMap(c => c.pages()).find(p => p.url() === `http://127.0.0.1:${port}/`), '测试页面');
    await page.locator('#draft').fill('主页面未保存内容');
    const identity = await page.evaluate(() => window.identity);
    const a = await (await page.$('#a')).contentFrame();
    const b = await (await page.$('#b')).contentFrame();
    const bIdentity = await b.evaluate(() => window.identity);
    async function reload(frame) {
      const previous = await frame.evaluate(() => window.identity);
      fs.rmSync(path.join(dir, 'menu.json'), { force: true });
      await frame.locator('#hit').click({ button: 'right' });
      const labels = await wait(() => fs.existsSync(path.join(dir, 'menu.json')) && JSON.parse(fs.readFileSync(path.join(dir, 'menu.json'), 'utf8')), '菜单事件');
      assert.ok(labels.includes('刷新框架'), `iframe 菜单缺少刷新框架：${JSON.stringify(labels)}`);
      await wait(async () => { try { return await frame.evaluate(value => window.identity !== value, previous); } catch { return false; } }, '仅框架重载');
    }
    // 站点阻止默认菜单产生的旧标记不能影响下一次在别的框架右键。
    await b.evaluate(() => window.addEventListener('contextmenu', event => event.preventDefault(), { once: true }));
    await b.locator('#hit').click({ button: 'right' });
    await reload(a);
    assert.equal(await b.evaluate(() => window.identity), bIdentity, '同 URL 兄弟框架不能被刷新');
    const outer = await (await page.$('#cross')).contentFrame();
    const nested = await (await outer.$('iframe')).contentFrame();
    const outerIdentity = await outer.evaluate(() => window.identity);
    await reload(nested);
    assert.equal(await outer.evaluate(() => window.identity), outerIdentity, '嵌套刷新不能重载外层');
    // 动态移除与新建框架仍能刷新，不能保留已销毁框架作为菜单目标。
    await page.evaluate(() => { document.querySelector('#a').remove(); const frame = document.createElement('iframe'); frame.id = 'replacement'; frame.src = '/frame'; document.body.append(frame); });
    const replacement = await (await page.$('#replacement')).contentFrame();
    await replacement.waitForLoadState();
    await reload(replacement);
    assert.equal(await page.evaluate(() => window.identity), identity);
    assert.equal(await page.locator('#draft').inputValue(), '主页面未保存内容');
    fs.rmSync(path.join(dir, 'menu.json'), { force: true });
    await page.locator('h1').click({ button: 'right' });
    const labels = await wait(() => fs.existsSync(path.join(dir, 'menu.json')) && JSON.parse(fs.readFileSync(path.join(dir, 'menu.json'), 'utf8')), '主页面菜单');
    assert.ok(!labels.includes('刷新框架'), '顶层页面不显示框架刷新');
    console.log('PASS 原生框架菜单、同 URL 精确定位、跨源嵌套刷新、主页面及表单保留');
  } finally {
    fs.writeFileSync(path.join(dir, 'native.log'), log, 'utf8');
    if (child.exitCode === null) await new Promise(resolve => spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('exit', resolve));
    if (browser) await browser.close().catch(() => {});
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
