/** 使用独立浏览器和模拟密码库验证密码表格，不读取用户真实凭据或系统剪贴板。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:1440/');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: Settings } = await import('/src/components/BrowserSettingsPage.tsx');
      const rows = Array.from({ length: 503 }, (_, index) => ({
        id: String(index), name: `测试网站 ${index}`, origin: `https://site-${index}.example`,
        username: `user-${index}`, source: '测试', createdAt: 1, updatedAt: 1,
      }));
      window.passwordTest = { reads: 0, copied: '', failRead: false, failCopy: false, delay: false };
      window.__TAURI__ = { core: { invoke: async (command, args) => {
        if (command === 'list_browser_passwords') return rows;
        if (command === 'get_browser_password') {
          window.passwordTest.reads++;
          if (window.passwordTest.failRead) throw new Error('模拟读取失败');
          if (window.passwordTest.delay) await new Promise(resolve => { window.passwordTest.resolve = resolve; });
          return { password: `Fake-password-${args.id}!` };
        }
        throw new Error(`测试未模拟的命令：${command}`);
      } } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => {
          if (window.passwordTest.failCopy) throw new Error('模拟复制失败');
          window.passwordTest.copied = text;
        },
      } });
      const host = document.createElement('div');
      host.id = 'password-test';
      host.style = 'position:fixed;inset:0;z-index:1000;background:white';
      document.body.append(host);
      createRoot(host).render(React.createElement(Settings, {
        initialSection: 'passwords', activeDownloadCount: 0, downloadCount: 0,
        downloadDirectory: '', askBeforeDownload: false,
      }));
    });
    const host = page.locator('#password-test');
    const table = host.locator('.browser-settings-passwords__table');
    const show = () => table.getByRole('button', { name: '显示密码', exact: true }).first();
    await show().waitFor();
    assert.equal(await page.evaluate(() => window.passwordTest.reads), 0);
    assert.equal(await table.getByText('Fake-password-0!', { exact: true }).count(), 0);
    // 大量账号由 Sia 表格窗口化渲染，不一次性挂载全部密码操作按钮。
    assert.ok(await table.getByRole('button', { name: '显示密码', exact: true }).count() < 100);
    await show().click();
    await table.getByText('Fake-password-0!', { exact: true }).waitFor();
    await table.getByRole('button', { name: '隐藏密码', exact: true }).click();
    assert.equal(await table.getByText('Fake-password-0!', { exact: true }).count(), 0);
    await table.getByRole('button', { name: '复制密码', exact: true }).first().click();
    await page.waitForFunction(() => window.passwordTest.copied === 'Fake-password-0!');
    assert.equal(await table.getByText('Fake-password-0!', { exact: true }).count(), 0);
    await host.getByPlaceholder('搜索站点或账号').fill('user-502');
    await table.getByText('user-502', { exact: true }).waitFor();
    await show().click();
    await table.getByText('Fake-password-502!', { exact: true }).waitFor();
    await host.getByRole('button', { name: '常规', exact: true }).click();
    await host.getByRole('button', { name: '密码', exact: true }).click();
    await show().waitFor();
    assert.equal(await table.getByText('Fake-password-502!', { exact: true }).count(), 0);
    await page.evaluate(() => { window.passwordTest.failRead = true; });
    await show().click();
    await page.getByText('读取密码失败，请重试', { exact: true }).waitFor();
    await page.evaluate(() => { window.passwordTest.failRead = false; window.passwordTest.failCopy = true; });
    await table.getByRole('button', { name: '复制密码', exact: true }).click();
    await page.getByText('复制密码失败，请重试', { exact: true }).waitFor();
    // 页面切换后返回的异步结果不能重新显示已离开的账号密码。
    await page.evaluate(() => { window.passwordTest.delay = true; });
    await show().click();
    await page.waitForFunction(() => Boolean(window.passwordTest.resolve));
    await host.getByRole('button', { name: '常规', exact: true }).click();
    await page.evaluate(() => window.passwordTest.resolve());
    await host.getByRole('button', { name: '密码', exact: true }).click();
    await show().waitFor();
    assert.equal(await table.getByText('Fake-password-502!', { exact: true }).count(), 0);
    console.log('PASS 密码表格：503 条虚拟滚动、默认隐藏、显示/隐藏、直接复制、搜索、离页清理和失败提示。');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
