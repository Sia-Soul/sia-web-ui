// 验证 Portal 内子表单独立提交、校验与父表单正常保存，防止查询误触发祖先写入。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[3] || 'http://127.0.0.1:4174/components/query-form', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const base = '/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/';
      const [{ Form }, { QueryForm }, { Input }, { Button }, { Modal }] = await Promise.all(
        ['Form', 'QueryForm', 'Input', 'Button', 'Modal'].map(name => import(`${base}${name}.tsx`))
      );
      const h = React.createElement;
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      window.result = { parent: 0, child: 0 };
      function Example() {
        const [open, setOpen] = React.useState(true);
        return h(Form, { onFinish: () => window.result.parent++ },
          h(Button, { type: 'submit' }, '保存父表单'),
          h(Modal, { open, title: '子表单', onCancel: () => setOpen(false), footer: null },
            h(QueryForm, {
              fields: [{ key: 'name', name: 'name', rules: [{ required: true, message: '请输入查询词' }], children: h(Input, { 'aria-label': '查询词' }) }],
              onSearch: () => { window.result.child++; }
            })));
      }
      createRoot(host).render(h(Example));
    });
    const query = page.getByRole('button', { name: '查询', exact: true });
    await query.click();
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => window.result), { parent: 0, child: 0 });
    await page.getByRole('textbox', { name: '查询词' }).fill('店铺');
    await query.click();
    await page.waitForFunction(() => window.result.child === 1);
    assert.equal(await page.evaluate(() => window.result.parent), 0);
    await page.getByRole('textbox', { name: '查询词' }).press('Enter');
    await page.waitForFunction(() => window.result.child === 2);
    assert.equal(await page.evaluate(() => window.result.parent), 0);
    await page.getByRole('dialog').getByRole('button', { name: /关闭/ }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '保存父表单' }).click();
    await page.waitForFunction(() => window.result.parent === 1);
    assert.deepEqual(await page.evaluate(() => window.result), { parent: 1, child: 2 });
    console.log('PASS: 子查询点击、回车和校验失败均不提交祖先；父表单可独立保存。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
