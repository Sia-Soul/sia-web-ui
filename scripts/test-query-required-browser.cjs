// 真实浏览器验证不可隐藏条件：历史配置、设置面板、保存、排序、动态变化均受同一约束。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright-core'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/query-form');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { QueryForm } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/QueryForm.tsx');
      const { Input } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Input.tsx');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const root = createRoot(host);
      window.savedQuery = { columns: [{ key: 'id', visible: true, order: 0 }], queryForm: { defaultCollapsed: false, fields: [{ key: 'code', visible: false, order: 0 }, { key: 'name', visible: true, order: 1 }, { key: 'absent', visible: false, order: 2 }] } };
      window.saves = [];
      const adapter = { load: async () => window.savedQuery, save: async (_, value) => { window.savedQuery = structuredClone(value); window.saves.push(structuredClone(value)); } };
      window.mountRequiredQuery = required => root.render(React.createElement(QueryForm, {
        showSettings: true, settings: { adapter, scope: { moduleName: 'test', businessKey: 'required-query' } },
        onSearch: () => {}, fields: [
          { key: 'code', name: 'code', settingsHideDisabled: required, children: React.createElement(Input, { placeholder: '商品编码' }) },
          { key: 'name', name: 'name', children: React.createElement(Input, { placeholder: '商品名称' }) },
        ],
      }));
      window.mountRequiredQuery(true);
    });
    await page.getByPlaceholder('商品编码').waitFor();
    assert.equal(await page.evaluate(() => window.saves.length), 0);
    await page.getByRole('button', { name: '查询设置', exact: true }).click();
    const code = page.getByRole('checkbox', { name: '显示 code', exact: true });
    await page.waitForFunction(() => document.querySelector('input[aria-label="显示 code"]')?.disabled);
    assert.equal(await code.isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: '显示 name', exact: true }).isDisabled(), false);
    await page.getByRole('button', { name: '下移 code', exact: true }).click();
    await page.getByRole('checkbox', { name: '显示 name', exact: true }).locator('..').click();
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    const saved = await page.evaluate(() => window.savedQuery);
    assert.equal(saved.queryForm.fields.find(field => field.key === 'code').visible, true);
    assert.equal(saved.queryForm.fields.find(field => field.key === 'code').order, 1);
    assert.equal(saved.queryForm.fields.find(field => field.key === 'name').visible, false);
    assert.equal(saved.queryForm.fields.find(field => field.key === 'absent').visible, false);
    assert.equal(saved.columns[0].key, 'id');
    await page.evaluate(() => window.mountRequiredQuery(false));
    await page.getByRole('button', { name: '查询设置', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="显示 code"]')?.disabled === false);
    await code.locator('..').click();
    assert.equal(await code.isChecked(), false);
    await page.getByRole('button', { name: '恢复默认', exact: true }).click();
    assert.equal(await code.isChecked(), true);
    console.log('PASS 查询条件禁止隐藏：历史隐藏覆盖、无自动写入、普通字段、排序、保存合并、动态解除与默认恢复。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
