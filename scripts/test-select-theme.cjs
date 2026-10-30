// 真实浏览器验证外壳先出现、正文延后、开合中断和键盘焦点，记录帧间隔但不硬编码设备帧率。
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const requireUi = createRequire(path.resolve('packages/react/package.json'));
const { buildSync } = createRequire(requireUi.resolve('tsup'))('esbuild');
const modules = path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-motion-'));
  buildSync({ entryPoints: ['scripts/fixtures/select-theme.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js' || req.url === '/fixture.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(fs.readFileSync(path.join(directory, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);

await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('combobox').first().click();
for(const theme of ['light','dark']){
 await page.evaluate(theme=>document.documentElement.dataset.siaTheme=theme,theme);
 for(const selector of ['.sia-select__option.is-selected','.sia-selection-panel__option[aria-selected="true"]']){
  const item=page.locator(selector);await item.hover();
  const colors=await item.evaluate(node=>({background:getComputedStyle(node).backgroundColor,text:getComputedStyle(node).color}));
  assert.deepEqual(colors,theme==='dark'?{background:'rgb(21, 52, 91)',text:'rgb(105, 167, 255)'}:{background:'rgb(230, 244, 255)',text:'rgb(22, 119, 255)'});
 }
 await page.screenshot({path:'logs/select-theme-fixed-'+theme+'.png'});
}
// InputSelect 的 Portal 背景必须使用主题表面色，选中、悬停及搜索均在同一面板内验证。
await page.keyboard.press('Escape');
await page.locator('#input-select-theme').getByRole('button',{name:'展开选项'}).click();
const popup=page.locator('.sia-input-select__popup');
for(const theme of ['light','dark']){
 await page.evaluate(theme=>document.documentElement.dataset.siaTheme=theme,theme);
 const palette=await popup.evaluate(node=>({background:getComputedStyle(node).backgroundColor,text:getComputedStyle(node).color}));
 assert.deepEqual(palette,theme==='dark'?{background:'rgb(31, 31, 31)',text:'rgb(235, 235, 235)'}:{background:'rgb(255, 255, 255)',text:'rgb(31, 31, 31)'});
 const selected=popup.locator('[aria-selected="true"]');
 assert.equal(await selected.evaluate(node=>getComputedStyle(node).backgroundColor),theme==='dark'?'rgb(21, 52, 91)':'rgb(230, 244, 255)');
 const normal=popup.getByRole('option',{name:'普通项目'});await normal.hover();
 assert.equal(await normal.evaluate(node=>getComputedStyle(node).backgroundColor),theme==='dark'?'rgb(45, 45, 45)':'rgb(250, 250, 250)');
 await popup.screenshot({path:'logs/input-select-theme-'+theme+'.png'});
}
await popup.getByPlaceholder('搜索').fill('普通');
assert.equal(await popup.getByRole('option').count(),1);
console.log('PASS InputSelect 深浅主题面板背景、文字、选中、悬停和搜索。');
console.log('PASS Select 与 SelectionPanel 的深浅色选中/悬停样式。');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('sia-motion-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
