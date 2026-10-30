// 从公开 Badge/Button 交互验证多个框架副本共享一个提示层，防止悬停时阴影和背景叠加。
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const requireUi = createRequire(path.resolve('packages/react/package.json'));
const { buildSync } = createRequire(requireUi.resolve('tsup'))('esbuild');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-title-tooltip-'));
  buildSync({ entryPoints: ['scripts/fixtures/title-tooltip.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req,res) => {
    if (req.url === '/fixture.js' || req.url === '/fixture.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(fs.readFileSync(path.join(directory, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><body><script src="/fixture.js"></script><script src="/fixture.js"></script></body>'); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'已启用'}).first().hover();
    await page.waitForTimeout(1000);
    const count=await page.locator('.sia-title-tooltip[data-sia-popup-layer]').count();
    assert.equal(count,1,'同一悬停目标只允许一个提示层');
    assert.equal(await page.locator('[data-sia-title-tooltip-host]').count(),1,'每个文档只有一个提示容器');
    await page.mouse.move(500,500);await page.waitForTimeout(400);
    assert.equal(await page.locator('.sia-title-tooltip[data-sia-popup-layer]').count(),0,'退出动画完成后移除提示');
    // 在页面运行期间继续加载副本，验证再次初始化不会累积监听和提示根节点。
    for(let index=0;index<3;index++) await page.addScriptTag({url:'/fixture.js'});
    await page.getByRole('button',{name:'已启用'}).last().hover();await page.waitForTimeout(1000);
    assert.equal(await page.locator('.sia-title-tooltip[data-sia-popup-layer]').count(),1,'后续模块重载仍只显示一个提示');
    assert.equal(await page.locator('[data-sia-title-tooltip-host]').count(),1);
    await page.mouse.move(500,500);await page.waitForTimeout(400);
    await page.getByRole('button',{name:'已启用'}).first().focus();await page.keyboard.press('Tab');await page.waitForTimeout(1000);
    assert.equal(await page.locator('.sia-title-tooltip[data-sia-popup-layer]').count(),1,'键盘聚焦复用同一提示');
    await page.keyboard.press('Escape');await page.waitForTimeout(400);
    assert.equal(await page.locator('.sia-title-tooltip[data-sia-popup-layer]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS 多框架副本的 Badge 悬停只有一层提示，退出后完整清理。');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); fs.rmSync(directory,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1});
