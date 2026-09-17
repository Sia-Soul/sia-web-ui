const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 监听真实下载事件并读取下载内容，确保按钮没有退回到新标签页导航。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/components/upload');
    // 关闭预览恢复鼠标焦点时不保留悬浮工具条，Tab 聚焦仍可操作。
    const card = page.locator('.sia-upload--picture-card .sia-upload__item').first();
    await card.hover();
    await card.getByRole('button', { name: '预览 山间日落.svg', exact: true }).click();
    await page.getByRole('button', { name: '关闭预览', exact: true }).click();
    await page.mouse.move(1000, 800); await page.waitForTimeout(200);
    assert.equal(await card.locator('.sia-upload__actions').evaluate(el => getComputedStyle(el).opacity), '0');
    await page.keyboard.press('Tab'); await page.waitForTimeout(200);
    assert.equal(await card.locator('.sia-upload__actions').evaluate(el => getComputedStyle(el).opacity), '1');
    const smallCard = page.locator('.sia-upload--compact-card .sia-upload__item').first();
    await smallCard.hover(); await page.waitForTimeout(200);
    assert.equal(Math.round((await smallCard.boundingBox()).width), 56);
    assert.equal(Math.round((await smallCard.boundingBox()).height), 56);
    const toolbarBounds = await smallCard.locator('.sia-upload__actions').boundingBox();
    assert.ok(toolbarBounds.width > 56);
    const smallBounds = await smallCard.boundingBox();
    assert.ok(Math.abs(toolbarBounds.x + toolbarBounds.width / 2 - smallBounds.x - smallBounds.width / 2) < 1);
    assert.ok(Math.abs(toolbarBounds.y + toolbarBounds.height / 2 - smallBounds.y - smallBounds.height / 2) < 1);
    assert.ok(await smallCard.locator('.sia-upload__actions').evaluate(el => [...el.querySelectorAll('button')].every(button => {
      const r = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })), '小卡片所有操作按钮均能命中，不被邻卡或自身裁切');
    const largeCard = page.locator('.sia-upload--picture-card').nth(2).locator('.sia-upload__item').first();
    const largeBounds = await largeCard.boundingBox();
    assert.equal(largeBounds.width, 160); assert.equal(largeBounds.height, 120);
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Upload } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Upload.tsx');
      const host = document.createElement('div'); host.id = 'download-test';
      host.style.cssText = 'position:fixed;inset:0;z-index:999;background:white'; document.body.append(host);
      const root = (dom.default ?? dom).createRoot(host);
      window.renderDownload = (listType, mode = 'local') => root.render(React.createElement(Upload, {
        listType, fileList: [{ uid: '1', name: '文件.txt', status: 'done', type: 'text/plain',
          ...(mode === 'local' ? { originFileObj: new File(['local-content'], '文件.txt', { type: 'text/plain' }) } : { url: 'https://download.example.test/file' }),
        }], onPreview: () => { window.didPreview = true; },
        downloadRequest: mode === 'custom' ? async () => new Blob(['custom-content']) : undefined,
      }));
      window.renderDownload('text');
    });
    const host = page.locator('#download-test');
    for (const listType of ['text', 'picture', 'picture-card']) {
      await page.evaluate(type => window.renderDownload(type), listType);
      if (listType === 'picture-card') {
        // 照片墙悬停后才显示居中操作区，不挤占缩略图高度。
        await page.mouse.move(1000, 800);
        await page.evaluate(() => document.activeElement?.blur());
        await page.waitForTimeout(180);
        const actions = host.locator('.sia-upload__actions');
        assert.equal(await actions.evaluate(el => getComputedStyle(el).opacity), '0');
        await host.locator('.sia-upload__item').hover();
        await page.waitForTimeout(180);
        assert.equal(await actions.evaluate(el => getComputedStyle(el).opacity), '1');
        assert.ok(await actions.evaluate(el => {
          const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect();
          return Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 1;
        }));
      }
      await host.getByRole('button', { name: '预览 文件.txt', exact: true }).click();
      assert.equal(await page.evaluate(() => window.didPreview), true);
      const [download] = await Promise.all([page.waitForEvent('download'), host.getByRole('button', { name: '下载 文件.txt', exact: true }).click()]);
      assert.equal(download.suggestedFilename(), '文件.txt');
      const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).toString(), 'local-content');
      // Edge 会打开自身的下载面板，不属于文件预览标签页。
      assert.equal(context.pages().filter(p => !p.url().startsWith('edge://downloads')).length, 1);
    }
    await page.route('https://download.example.test/file', route => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'remote-content' }));
    for (const mode of ['remote', 'custom']) {
      await page.evaluate(mode => window.renderDownload('text', mode), mode);
      const [download] = await Promise.all([page.waitForEvent('download'), host.getByRole('button', { name: '下载 文件.txt', exact: true }).click()]);
      const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).toString(), mode + '-content');
    }
    await page.unroute('https://download.example.test/file');
    await page.route('https://download.example.test/file', route => route.abort());
    await page.evaluate(() => window.renderDownload('text', 'remote'));
    await host.getByRole('button', { name: '下载 文件.txt', exact: true }).click();
    await page.getByText('下载失败，请检查文件地址、访问权限或跨域配置', { exact: true }).waitFor();
    // Edge 会打开自身的下载面板，不属于文件预览标签页。
      assert.equal(context.pages().filter(p => !p.url().startsWith('edge://downloads')).length, 1);
    console.log('PASS: 三种列表的预览和下载按钮、本地/跨域/自定义 Blob 内容、文件名、失败提示，下载无新标签页。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
