// 列设置草稿回归：父级重新渲染、尺寸变化不能丢失尚未应用的显隐选择。
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const output = path.resolve('logs/table-settings-draft');
fs.mkdirSync(output, { recursive: true });
// 从脚本位置推导源码地址，使其他开发者检出到不同目录时仍可执行回归。
const tableSource = '/@fs/' + path.resolve(__dirname, '../packages/react/src/components/Table/index.ts').replace(/\\/g, '/');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async source => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table, createColumnSettingPlugin } = await import(source);
      const { Button } = await import(source.replace('Table/index.ts', 'Button.tsx'));
      document.body.innerHTML = '';
      const host = document.createElement('div');
      document.body.append(host);
      window.saved = [];
      let snapshot = null;
      const adapter = { load: async () => snapshot, save: async (_, next) => { snapshot = next; window.saved.push(next); } };
      const plugin = createColumnSettingPlugin({ adapter, scope: { moduleName: 'draft-regression', businessKey: 'isolated' } });
      const columns = [{ key: 'name', dataIndex: 'name', title: '名称', width: 1000 }, { key: 'stock', dataIndex: 'stock', title: '库存', width: 1000 }];
      function Demo() {
        const [tick, setTick] = React.useState(0);
        const [extra, setExtra] = React.useState(false);
        const tableRef = React.useRef(null);
        window.refreshFixture = () => setTick(n => n + 1);
        window.changeColumns = setExtra;
        // 通过公开插件 API 模拟外部配置重新读取，数据仅存于当前浏览器。
        window.reloadFixture = () => {
          snapshot = { columns: columns.map((column, order) => ({ key: column.key, order, visible: true })), version: 1 };
          tableRef.current.getPluginApi('columnSetting').open();
        };
        return React.createElement(React.Fragment, null,
          React.createElement(Button, { onClick: () => tableRef.current.getPluginApi('columnSetting').open() }, '打开列设置'),
          React.createElement(Table, { ref: tableRef, rowKey: 'id', columns: extra ? [...columns, { key: 'extra', title: '新增列' }] : columns, dataSource: [{ id: 1, name: '受控数据', stock: tick }], plugins: [plugin] }));
      }
      createRoot(host).render(React.createElement(Demo));
    }, tableSource);
    // 等待真实有限动效完成后点击菜单，避免弹性位移中的坐标点击落到背景。
    const settleMotion = () => page.evaluate(() => Promise.all(document.getAnimations()
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => undefined))));
    const open = async () => {
      await page.getByRole('button', { name: '打开列设置', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: '应用', exact: true }).waitFor({ timeout: 8000 }).catch(async error => {
        console.log(await page.locator('body').innerText());
        await page.screenshot({ path: path.join(output, 'diagnostic.png') });
        throw error;
      });
      await settleMotion();
    };
    await open();
    const dialog = page.getByRole('dialog');
    const checkbox = dialog.getByRole('checkbox', { name: '显示库存列', exact: true });
    await checkbox.press('Space');
    assert.equal(await checkbox.isChecked(), false, '键盘空格取消选择');
    await page.evaluate(() => window.refreshFixture());
    await page.waitForTimeout(200);
    assert.equal(await checkbox.isChecked(), false, '父级刷新保留草稿');
    for (const width of [900, 1920, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(400);
      assert.equal(await checkbox.isChecked(), false, `${width}px 尺寸变化保留草稿`);
    }
    await dialog.getByRole('button', { name: '应用', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.saved.at(-1).columns.find(c => c.key === 'stock').visible), false, '保存真实草稿');
    await open();
    assert.equal(await checkbox.isChecked(), false, '重开读取保存值');
    await checkbox.locator('xpath=ancestor::label[1]').click();
    await page.evaluate(() => window.refreshFixture());
    await page.waitForTimeout(200);
    assert.equal(await checkbox.isChecked(), true, '鼠标更改也保留');
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await open();
    assert.equal(await checkbox.isChecked(), false, '取消后重开恢复保存值');
    await checkbox.press('Space');
    await page.evaluate(() => window.changeColumns(true));
    await dialog.getByRole('checkbox', { name: '显示新增列列', exact: true }).waitFor();
    assert.equal(await checkbox.isChecked(), false, '真实列变化同步保存配置，不沿用旧草稿');
    await page.evaluate(() => window.changeColumns(false));
    await dialog.getByRole('checkbox', { name: '显示新增列列', exact: true }).waitFor({ state: 'detached' });
    await page.evaluate(() => window.reloadFixture());
    await page.waitForFunction(() => document.querySelector('input[aria-label="显示库存列"]')?.checked === true);
    assert.equal(await checkbox.isChecked(), true, '外部配置变化同步到打开的面板');
    // 实际拖动期间发生列变化应取消旧拖拽，不能继续应用已经过期的排序。
    const name = await dialog.locator('[data-column-key="name"] .sia-table-settings__name').boundingBox();
    const stock = await dialog.locator('[data-column-key="stock"]').boundingBox();
    await page.mouse.move(name.x + 5, name.y + name.height / 2);
    await page.mouse.down();
    await page.mouse.move(stock.x + 40, stock.y + stock.height, { steps: 10 });
    await dialog.locator('.is-dragging').waitFor();
    await page.evaluate(() => window.changeColumns(true));
    await dialog.locator('.is-dragging').waitFor({ state: 'detached' });
    await page.mouse.up();
    await dialog.getByRole('button', { name: '应用', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.saved.at(-1).columns.map(c => c.key)), ['name', 'stock', 'extra'], '保存新列集合且无旧拖拽排序');
    console.log('PASS 15 checks: draft, keyboard, resize, persistence, dynamic columns, external reload, drag cancellation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
