const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 监听真实下载事件并读取下载内容，确保按钮没有退回到新标签页导航。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/components/upload');
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
