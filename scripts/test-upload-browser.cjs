/** 浏览器行为回归：真实 File/剪贴板/目录条目、异步请求取消及 XHR 请求体。 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
const base = process.env.SIA_DOCS_URL || 'http://127.0.0.1:4173';
const root = path.resolve(__dirname, '..').replaceAll('\\', '/');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
const file = (name = 'sample.png') => ({ name, mimeType: 'image/png', buffer: png });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/components/upload`);
    const wall = page.locator('[aria-label="照片墙"]');
    await wall.waitFor();
    await wall.locator('input[type=file]').setInputFiles([file('one.png'), file('two.png')]);
    await page.waitForFunction(() => document.querySelector('[aria-label="照片墙"]').querySelectorAll('.sia-upload__item').length === 6);
    assert.equal(await wall.locator('.sia-upload__trigger').count(), 0);
    await wall.getByRole('button', { name: '移除 one.png', exact: true }).evaluate(el => el.click());
    await wall.locator('.sia-upload__trigger').waitFor();
    await wall.getByRole('button', { name: '预览 山间日落.svg' }).click();
    await page.getByRole('dialog', { name: '图片预览' }).waitFor();
    await page.getByRole('button', { name: '关闭预览' }).click();
    await page.screenshot({ path: 'apps/docs/upload-modes-verified.png' });
    await page.locator('[aria-label="拖拽与粘贴上传"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'apps/docs/upload-drop-verified.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await wall.scrollIntoViewIfNeeded();
    assert(await wall.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '照片墙在窄屏应自动换行');
    await page.screenshot({ path: 'apps/docs/upload-mobile-verified.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // 单独挂载真实组件，以便控制网络回调和外部受控列表，不修改演示页业务逻辑。
    await page.evaluate(async root => {
      const ReactModule = await import('/node_modules/.vite/deps/react.js');
      const React = ReactModule.default || ReactModule;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = dom.default || dom;
      const { Upload } = await import(`/@fs/${root}/packages/react/src/components/Upload.tsx`);
      const host = document.createElement('div');
      host.id = 'upload-regression';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:white;padding:24px;overflow:auto';
      document.body.append(host);
      const app = createRoot(host);
      window.uploadTest = { events: [], calls: [], rejected: [], aborted: 0, ref: React.createRef() };
      window.mountUpload = (options = {}) => {
        const t = window.uploadTest;
        t.events = []; t.calls = []; t.rejected = []; t.aborted = 0;
        function Harness() {
          const [files, setFiles] = React.useState([]);
          t.setFiles = setFiles;
          t.files = files;
          return React.createElement(Upload, {
            multiple: true, pastable: true, 'aria-label': '测试上传', ...options,
            ref: t.ref, fileList: files,
            onChange: info => { t.events.push(info.event); setFiles([...info.fileList]); },
            onReject: info => t.rejected.push(info.reason),
            request: options.signing ? (_file, signal) => {
              t.signSignal = signal;
              return new Promise(resolve => { t.resolveSign = resolve; });
            } : options.request,
            onPreview: options.customPreview ? () => { t.previewed = true; } : undefined,
            onRemove: options.rejectRemove ? () => Promise.reject(new Error('保留')) : undefined,
            beforeUpload: options.validation ? f => {
              if (f.name.startsWith('ignore')) return Upload.LIST_IGNORE;
              if (f.name.startsWith('error')) throw new Error('校验失败');
              if (f.name.startsWith('hold')) return false;
              return new File(['converted'], 'converted.txt', { type: 'text/plain' });
            } : undefined,
            customRequest: options.http || options.local ? undefined : options.asyncHandle ? request => {
              t.calls.push(request);
              return new Promise(resolve => { t.resolveHandle = () => resolve({ abort() { t.aborted++; } }); });
            } : options.syncError ? () => { throw new Error('SDK 初始化失败'); } : request => {
              t.calls.push(request);
              return { abort() { t.aborted++; } };
            },
          });
        }
        app.render(React.createElement(React.StrictMode, null, React.createElement(Harness, { key: Math.random() })));
      };
      window.unmountUpload = () => app.unmount();
    }, root);
    const mount = async options => { await page.evaluate(options => window.mountUpload(options), options); await page.waitForTimeout(50); };
    const input = page.locator('#upload-regression input[type=file]');
    const waitFiles = count => page.waitForFunction(count => window.uploadTest.files.length === count, count);
    const waitStatus = status => page.waitForFunction(status => window.uploadTest.files[0]?.status === status, status);
    const state = () => page.evaluate(() => ({ statuses: window.uploadTest.files.map(f => f.status), count: window.uploadTest.calls.length, aborted: window.uploadTest.aborted, events: window.uploadTest.events, rejected: window.uploadTest.rejected }));

    await mount({ autoUpload: false, maxCount: 2 });
    await input.setInputFiles([file('a.png'), file('b.png'), file('c.png')]);
    await waitFiles(2);
    assert.equal((await state()).count, 0);
    assert.deepEqual((await state()).rejected, ['max-count']);
    await page.evaluate(() => { void window.uploadTest.ref.current.upload(); });
    await page.waitForFunction(() => window.uploadTest.calls.length === 2);
    await page.evaluate(() => window.uploadTest.ref.current.abort());
    assert.deepEqual((await state()).statuses, ['ready', 'ready']);
    assert.equal((await state()).aborted, 2);
    await page.evaluate(() => window.uploadTest.calls[0].onSuccess('late'));
    assert.deepEqual((await state()).statuses, ['ready', 'ready']);
    await page.evaluate(() => { void window.uploadTest.ref.current.upload(window.uploadTest.files[0].uid); });
    await page.waitForFunction(() => window.uploadTest.calls.length === 3);
    await page.evaluate(() => window.uploadTest.calls[2].onError(new Error('retry')));
    await waitStatus('error');
    await page.evaluate(() => { void window.uploadTest.ref.current.upload(window.uploadTest.files[0].uid); });
    await page.waitForFunction(() => window.uploadTest.calls.length === 4);
    await page.evaluate(() => window.uploadTest.calls[3].onSuccess({ ok: true }, '/files/a.png'));
    await waitStatus('done');
    assert.equal(await page.evaluate(() => window.uploadTest.files[0].url), '/files/a.png');

    await mount({ accept: 'image/*', maxCount: 2 });
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['hello'], 'pasted.png', { type: 'image/png' }));
      transfer.items.add(new File(['hello'], 'bad.txt', { type: 'text/plain' }));
      document.querySelector('#upload-regression .sia-upload').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
    });
    await waitFiles(1);
    assert.deepEqual((await state()).rejected, ['accept']);
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['drop'], 'dropped.png', { type: 'image/png' }));
      document.querySelector('#upload-regression .sia-upload').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await waitFiles(2);
    await page.evaluate(() => window.uploadTest.setFiles([]));
    await waitFiles(0);
    await page.waitForFunction(() => window.uploadTest.aborted === 2);
    await page.evaluate(() => window.uploadTest.calls.forEach(call => call.onSuccess('late')));
    await waitFiles(0);

    await mount({ validation: true });
    await input.setInputFiles([file('ignore.png'), file('error.png'), file('hold.png'), file('convert.png')]);
    await waitFiles(3);
    await page.waitForFunction(() => window.uploadTest.calls.length === 1);
    assert.deepEqual((await state()).statuses, ['error', 'ready', 'uploading']);
    assert.equal(await page.evaluate(() => window.uploadTest.calls[0].file.name), 'converted.txt');
    await mount({ rejectRemove: true });
    await input.setInputFiles(file());
    await waitFiles(1);
    await page.evaluate(() => window.uploadTest.ref.current.remove(window.uploadTest.files[0].uid));
    await waitFiles(1);
    await mount({ syncError: true });
    await input.setInputFiles(file());
    await waitStatus('error');
    await mount({ local: true });
    await input.setInputFiles(file());
    await waitStatus('ready');
    assert(!(await state()).events.includes('success'));

    await mount({ asyncHandle: true });
    await input.setInputFiles(file());
    await page.waitForFunction(() => window.uploadTest.calls.length === 1);
    await page.evaluate(() => { window.uploadTest.ref.current.abort(); window.uploadTest.resolveHandle(); });
    await page.waitForFunction(() => window.uploadTest.aborted === 1);
    assert(await page.evaluate(() => window.uploadTest.calls[0].signal.aborted));
    await waitStatus('ready');

    await mount({ directory: true, recursive: false, local: true });
    assert.equal(await input.getAttribute('webkitdirectory'), '');
    await input.evaluate(el => {
      const transfer = new DataTransfer();
      for (const relativePath of ['root/a.txt', 'root/sub/b.txt', 'root/c.txt']) {
        const f = new File(['directory'], relativePath.split('/').at(-1));
        Object.defineProperty(f, 'webkitRelativePath', { value: relativePath });
        transfer.items.add(f);
      }
      el.files = transfer.files;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await waitFiles(2);
    assert.deepEqual(await page.evaluate(() => window.uploadTest.files.map(f => f.relativePath)), ['root/a.txt', 'root/c.txt']);
    await mount({ disabled: true });
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['x'], 'disabled.png', { type: 'image/png' }));
      const target = document.querySelector('#upload-regression .sia-upload');
      target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await waitFiles(0);

    // 真实 XHR 验证 PUT 二进制、POST 表单字段和失败状态，无需云端凭据。
    const requests = [];
    await page.route('**/__upload_test*', async route => {
      requests.push({ method: route.request().method(), body: route.request().postData(), headers: route.request().headers() });
      await route.fulfill({ status: route.request().url().includes('fail') ? 403 : 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await mount({ http: true, signing: true });
    await input.setInputFiles(file());
    await page.waitForFunction(() => !!window.uploadTest.resolveSign);
    await page.evaluate(() => {
      window.uploadTest.ref.current.abort();
      window.uploadTest.resolveSign({ action: '/__upload_test', method: 'PUT', body: 'file' });
    });
    await waitStatus('ready');
    assert(await page.evaluate(() => window.uploadTest.signSignal.aborted));
    await page.waitForTimeout(60);
    assert.equal(requests.length, 0, '取消签名阶段后不应再发送上传请求');
    await mount({ http: true, request: { action: '/__upload_test', method: 'PUT', body: 'file', headers: { 'x-upload-test': 'signed' }, url: '/uploaded.png' } });
    await input.setInputFiles(file()); await waitStatus('done');
    assert.equal(requests.at(-1).method, 'PUT');
    assert.equal(requests.at(-1).headers['x-upload-test'], 'signed');
    assert(!requests.at(-1).headers['content-type'].includes('multipart'));
    await mount({ http: true, request: { action: '/__upload_test', data: { key: 'folder/photo.png', policy: 'signed-policy' }, name: 'asset' } });
    await input.setInputFiles(file()); await waitStatus('done');
    assert.match(requests.at(-1).body, /name="key"[\s\S]*folder\/photo.png/);
    assert.match(requests.at(-1).body, /name="asset"; filename="sample.png"/);
    await mount({ http: true, request: { action: '/__upload_test_fail' } });
    await input.setInputFiles(file()); await waitStatus('error');

    // 模拟分批目录 API，与浏览器真实条目协议一致，覆盖多批、子目录及空目录。
    const directoryResult = await page.evaluate(async root => {
      const { readUploadEntries, includeUploadPath } = await import(`/@fs/${root}/packages/react/src/components/uploadFiles.ts`);
      const leaf = name => ({ name, isFile: true, isDirectory: false, file: resolve => resolve(new File(['x'], name)) });
      const folder = (name, batches) => ({ name, isFile: false, isDirectory: true, createReader: () => { let i = 0; return { readEntries: resolve => resolve(batches[i++] || []) }; } });
      const tree = folder('root', [[leaf('a.txt')], [folder('sub', [[leaf('b.txt')]]), leaf('c.txt')], [folder('empty', [])]]);
      return { recursive: (await readUploadEntries([tree], true)).map(x => x.path), shallow: (await readUploadEntries([tree], false)).map(x => x.path), filter: includeUploadPath('root/sub/b.txt', false) };
    }, root);
    assert.deepEqual(directoryResult.recursive, ['root/a.txt', 'root/sub/b.txt', 'root/c.txt']);
    assert.deepEqual(directoryResult.shallow, ['root/a.txt', 'root/c.txt']);
    assert.equal(directoryResult.filter, false);
    await mount({});
    await input.setInputFiles(file());
    await page.waitForFunction(() => window.uploadTest.calls.length === 1);
    await page.evaluate(() => window.unmountUpload());
    assert.equal((await state()).aborted, 1);
    assert.deepEqual(errors, []);
    console.log('PASS Upload: wall limit, preview, manual/controlled lifecycle, cancel/retry/late callbacks, paste/drop, validation, local selection, HTTP PUT/POST/failure, directory batches/recursion, unmount.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
