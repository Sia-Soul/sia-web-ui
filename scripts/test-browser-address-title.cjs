const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const root = 'D:/SiaBuild/SiaWebUI/frontend-dist/browser';
  const server = http.createServer((request, response) => {
    try {
      const file = path.join(root, request.url === '/' ? 'index.html' : request.url);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      window.calls = [];
      window.handlers = {};
      window.__TAURI__ = {
        event: { listen: async (name, handler) => { window.handlers[name] = handler; return () => {}; } },
        core: { invoke: async (name, args) => {
          window.calls.push({ name, args });
          if (name === 'current_window_label') return 'main';
          if (name === 'load_browser_state') return { version: 3, activeId: 'test', groups: [], tabs: [
            { id: 'test', title: '哔哩哔哩 — 当前网页的标题与很长的说明文字', url: 'https://www.bilibili.com/video/test', groupId: 'other' },
          ] };
        } },
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const title = page.locator('.browser-address-title');
    const input = page.getByRole('textbox', { name: '地址和搜索栏' });
    await title.waitFor();
    await page.waitForFunction(() => document.querySelector('.browser-address-title').textContent.includes('哔哩'));
    await title.click();
    assert.equal(await input.evaluate(e => e === document.activeElement), false, 'title must not steal focus for input');
    const actions = () => page.evaluate(() => window.calls.filter(c => c.name === 'browser_window_action'));
    assert.deepEqual((await actions()).map(c => c.args.action), ['start-dragging']);
    await title.click({ button: 'right' });
    assert.equal((await actions()).length, 1, 'right click must not drag');
    await input.click();
    await input.fill('https://example.com/edited');
    assert.equal(await input.inputValue(), 'https://example.com/edited');
    assert.equal((await actions()).length, 1, 'URL editing must not drag window');
    await page.evaluate(() => window.handlers['sia://browser-event']({ payload: { kind: 'title', tabId: 'test', title: '标题更新后的当前网页名称与很长的说明文字' } }));
    await page.waitForFunction(() => document.querySelector('.browser-address-title').textContent.startsWith('标题更新'));
    for (const width of [960, 1200]) {
      await page.setViewportSize({ width, height: 800 });
      const geometry = await title.evaluate(e => {
        const control = e.closest('.sia-input-control');
        const text = e.querySelector('.browser-address-title__text');
        return { title: e.getBoundingClientRect().width, control: control.getBoundingClientRect().width,
          input: control.querySelector('input').getBoundingClientRect().width,
          ellipsis: getComputedStyle(text).textOverflow, overflows: text.scrollWidth > text.clientWidth };
      });
      assert.ok(geometry.title <= geometry.control * .34);
      assert.ok(geometry.input > geometry.control * .4);
      assert.equal(geometry.ellipsis, 'ellipsis');
      assert.ok(geometry.overflows);
    }
    await input.blur();
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/address-title.png', clip: { x: 0, y: 0, width: 1200, height: 48 } });
    console.log('PASS title tracks page, left press invokes native dragging without focus, right click and URL editing do not drag, narrow layout truncates title');
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
