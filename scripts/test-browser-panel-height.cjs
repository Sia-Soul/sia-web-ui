const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const root = 'D:/SiaBuild/SiaWebUI/frontend-dist/browser';
  const server = http.createServer((request, response) => {
    try {
      const file = path.join(root, request.url);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    await page.addInitScript(() => {
      window.handlers = {};
      window.__TAURI__ = {
        event: { listen: async (name, handler) => { window.handlers[name] = handler; return () => {}; } },
        core: { invoke: async name => name === 'list_browser_extensions' ? window.testExtensions : undefined },
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/menu.html`);
    await page.waitForFunction(() => window.handlers['sia://browser-menu-state']);
    const entry = index => ({ id: String(index), title: '测试项目 ' + index, url: 'https://example.com', state: 'started', receivedBytes: 0, timestamp: Date.now() });
    const item = index => ({ key: String(index), label: '菜单项目 ' + index });
    async function show(kind, count, cascade = false) {
      const entries = Array.from({ length: count }, (_, index) => entry(index));
      const items = Array.from({ length: count }, (_, index) => item(index));
      if (cascade) items[0].children = Array.from({ length: 30 }, (_, index) => item(index));
      const extensions = entries.map(e => ({ id: e.id, name: e.title, enabled: true }));
      await page.evaluate(({ payload, extensions }) => {
        window.testExtensions = extensions;
        window.handlers['sia://browser-menu-state']({ payload });
      }, { extensions, payload: { kind, entries, items, extensions, darkMode: false,
        menuLayout: cascade ? { left: 20, top: 20, width: 300, height: 740 } : undefined } });
      await page.waitForTimeout(100);
      return page.locator('.browser-panel, .browser-window-menu').first();
    }
    for (const kind of ['downloads', 'history', 'bookmarks', 'extensions', 'menu', 'back-history']) {
      const small = await show(kind, 1);
      const shortHeight = (await small.boundingBox()).height;
      assert.ok(shortHeight < 400, `${kind} should fit one item: ${shortHeight}`);
      const large = await show(kind, 40);
      const tallHeight = (await large.boundingBox()).height;
      assert.equal(tallHeight, 640, `${kind} maximum`);
      const scrollable = kind === 'menu' || kind === 'back-history' ? large : page.locator('.browser-panel__scroll');
      assert.ok(await scrollable.evaluate(e => e.scrollHeight > e.clientHeight), `${kind} must scroll`);
      await page.setViewportSize({ width: 800, height: 360 });
      assert.ok((await large.boundingBox()).height <= 320, `${kind} small window`);
      await page.setViewportSize({ width: 800, height: 800 });
      console.log(`PASS ${kind}: natural height, maximum, overflow, small window`);
    }
    const cascade = await show('menu', 2, true);
    assert.ok((await cascade.boundingBox()).height < 160, 'cascade root must ignore reserved canvas height');
    await cascade.locator('.sia-menu__item').first().hover();
    const submenu = page.locator('.sia-menu__popup.is-open');
    await submenu.waitFor();
    assert.ok((await submenu.boundingBox()).height <= 640, 'submenu outer height includes padding and border');
    const list = submenu.locator('.sia-menu__popup-list');
    assert.ok(await list.evaluate(e => e.clientHeight <= 640 && e.scrollHeight > e.clientHeight));
    console.log('PASS cascade root natural height and long submenu scrolling');
  } finally {
    await browser.close();
    server.closeAllConnections();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
