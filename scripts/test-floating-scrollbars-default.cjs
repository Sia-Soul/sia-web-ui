// 真实浏览器验证外壳先出现、正文延后、开合中断和键盘焦点，记录帧间隔但不硬编码设备帧率。
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const requireUi = createRequire(path.resolve('packages/react/package.json'));
const { build } = createRequire(requireUi.resolve('tsup'))('esbuild');
const modules = path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-floating-'));
  await build({ entryPoints: ['scripts/fixtures/floating-scrollbars.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' }, plugins: process.env.SIA_TEST_PUBLISHED ? [{ name: 'published-core', setup(build) { build.onResolve({ filter: /packages\/react\/src\/core$/ }, () => ({ path: path.resolve('packages/react/dist/core.js') })); } }] : [] });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js' || req.url === '/fixture.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(fs.readFileSync(path.join(directory, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const floating = '#nested-scroll[data-sia-floating-scrollbar]';
    await page.locator(floating).waitFor();
    assert.equal(await page.locator(floating).evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    assert.equal(await page.locator('[data-sia-native-scrollbar][data-sia-floating-scrollbar]').count(), 0);
    assert.equal(await page.locator('.sia-floating-scrollbar-layer').count(), 1, '默认只创建一份全局观察器');
    await page.locator(floating).hover();
    assert.ok(await page.locator('.sia-floating-scrollbar--visible:not([hidden])').count() >= 2);
    await page.locator(floating).evaluate(node => { node.scrollTop = 90; node.scrollLeft = 80; });
    assert.deepEqual(await page.locator(floating).evaluate(node => [node.scrollTop, node.scrollLeft]), [90, 80]);
    await page.evaluate(() => window.setScrollbarDisabled(true));
    await page.waitForFunction(() => !document.querySelector('#nested-scroll[data-sia-floating-scrollbar]'));
    assert.notEqual(await page.locator('#nested-scroll').evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    await page.evaluate(() => window.setScrollbarDisabled(false));
    await page.locator(floating).waitFor();
    await page.evaluate(() => window.setNative(true));
    await page.waitForFunction(() => !document.querySelector('#nested-scroll[data-sia-floating-scrollbar]'));
    await page.evaluate(() => window.setNative(false));
    await page.locator(floating).waitFor();
    await page.evaluate(() => { window.setScrollbarDisabled(undefined); window.setDynamic(true); });
    await page.locator('#dynamic-scroll[data-sia-floating-scrollbar]').waitFor();
    // 页面被弹层锁定时，根轨道也必须退出；解锁后正常恢复。
    await page.evaluate(() => { document.body.style.minHeight = '2000px'; });
    await page.locator('html[data-sia-floating-scrollbar]').waitFor();
    await page.evaluate(() => { document.body.style.overflow = 'hidden'; });
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-sia-floating-scrollbar'));
    await page.evaluate(() => { document.body.style.overflow = ''; document.body.style.minHeight = ''; });
    await page.getByRole('button', { name: '收起资源面板' }).click();
    const rail = await page.locator('.sia-tool-panel__rail').evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth, x: getComputedStyle(node).overflowX }));
    assert.equal(rail.x, 'hidden');
    assert.equal(rail.scroll, rail.client, '收起活动栏无水平溢出');
    // 各种宽度的滑块最终位置必须在轨道内，按压只变换视觉而不改变布局。
    for (const label of ['开关', '长文字', '分段']) {
      const control = page.getByRole('switch', { name: label, exact: true });
      await page.getByText(label, { exact: true }).click();
      assert.ok(await control.isChecked());
      await page.waitForTimeout(280);
      const box = await control.evaluate(input => {
        const track = input.nextElementSibling; const thumb = track.querySelector('.sia-switch__thumb');
        const a = track.getBoundingClientRect(), b = thumb.getBoundingClientRect();
        return { right: a.right - b.right, left: b.left - a.left, travel: getComputedStyle(thumb).transform };
      });
      assert.ok(box.right >= 1 && box.right <= 5, JSON.stringify(box));
      assert.ok(box.left > 2);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.sia-switch__thumb').first().evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    console.log('PASS 默认浮动滚动条、原生外层嵌套、动态接管、禁用恢复、ToolPanel 收起、Switch 位移');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('sia-floating-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
