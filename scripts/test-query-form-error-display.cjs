// 接口异常不应渲染成页面正文；统一请求提示只出现一次，未提供回调也不泄露异常文本。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/components/query-form');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { QueryForm, Input, message } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      document.body.innerHTML = '';
      const host = document.createElement('div');
      document.body.append(host);
      window.attempts = 0;
      window.failQuery = true;
      createRoot(host).render(React.createElement(QueryForm, {
        initialValues: { name: '保留查询条件' },
        fields: [{ name: 'name', key: 'name', children: React.createElement(Input, { 'aria-label': '名称' }) }],
        onSearch: async () => {
          window.attempts++;
          if (!window.failQuery) return;
          // 模拟统一请求层已给出业务提示后拒绝 Promise，不连接或写入任何业务接口。
          message.error('受控业务提示：商家配置不完整');
          throw new Error('http error');
        },
      }));
    });
    await page.getByRole('button', { name: '查询', exact: true }).click();
    await page.getByText('受控业务提示：商家配置不完整', { exact: true }).waitFor();
    assert.equal(await page.getByText('受控业务提示：商家配置不完整', { exact: true }).count(), 1);
    assert.equal(await page.getByText('http error', { exact: true }).count(), 0);
    assert.equal(await page.locator('.sia-query-form__error').count(), 0);
    assert.equal(await page.getByRole('textbox', { name: '名称', exact: true }).inputValue(), '保留查询条件');
    assert(await page.getByRole('button', { name: '查询', exact: true }).isEnabled());
    await page.screenshot({ path: 'logs/query-error-feedback/request-error.png' });
    await page.evaluate(() => { window.failQuery = false; });
    await page.getByRole('button', { name: '查询', exact: true }).click();
    await page.waitForFunction(() => window.attempts === 2);
    assert.deepEqual(errors, []);
    console.log('PASS no onError: one business toast, no raw http error, retained conditions, unlocked and retryable query, no runtime errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
