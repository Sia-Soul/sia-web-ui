const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 覆盖直接 Dropdown、表格设置菜单和工具栏，尤其验证禁用项的原因提示及点击限制。
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/dropdown');
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Dropdown, Button, Table, createColumnSettingPlugin, createToolbarPlugin } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      window.titleClicks = 0;
      const items = [
        { key: 'enabled', label: '普通操作', title: '普通操作说明', onClick: () => window.titleClicks++ },
        { key: 'disabled', label: '自定义权限', title: '当前没有权限', disabled: true, onClick: () => window.titleClicks++ },
      ];
      createRoot(host).render(R.createElement('div', null,
        R.createElement(Dropdown, { trigger: ['click'], menu: { items } }, R.createElement(Button, null, '直接菜单')),
        R.createElement(Table, { columns: [{ key: 'name', title: '名称', dataIndex: 'name' }], dataSource: [{ key: '1', name: '测试' }],
          plugins: [createColumnSettingPlugin({ showExport: false, menuItems: items }), createToolbarPlugin({ items: [{ key: 'bar', label: '工具栏提示', title: '工具栏操作说明' }] })] }),
      ));
    });
    const tip = page.locator('.sia-title-tooltip');
    for (const trigger of ['直接菜单', '表格设置']) {
      await page.getByRole('button', { name: trigger, exact: true }).click();
      for (const [label, text] of [['普通操作', '普通操作说明'], ['自定义权限', '当前没有权限']]) {
        const item = page.locator('.sia-dropdown__popup.is-open .sia-dropdown__menu').getByRole('button', { name: label, exact: true });
        await item.hover();
        await tip.waitFor({ state: 'visible' });
        assert.equal(await tip.textContent(), text);
        if (label === '自定义权限') {
          assert(await item.isDisabled());
          await item.evaluate(el => el.click());
          assert.equal(await page.evaluate(() => window.titleClicks), 0);
        }
        await page.mouse.move(0, 0);
        await tip.waitFor({ state: 'hidden' });
      }
      await page.keyboard.press('Escape');
      await page.locator('.sia-dropdown__popup').waitFor({ state: 'detached' });
    }
    await page.getByRole('button', { name: '工具栏提示', exact: true }).hover();
    await tip.waitFor({ state: 'visible' });
    assert.equal(await tip.textContent(), '工具栏操作说明');
    console.log('PASS Dropdown and table titles: enabled/disabled menu items, leave cleanup, disabled click prevention, toolbar.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
