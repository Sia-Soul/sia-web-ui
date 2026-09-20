const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 在真实布局中验证标签收纳、容器扩缩与菜单交互，覆盖全部横向样式。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/tabs');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Tabs } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Tabs.tsx');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const root = (dom.default ?? dom).createRoot(host);
      window.renderTabs = (type, width, extra = {}) => root.render(React.createElement(Tabs, {
        type, style: { width }, tabBarTitle: '品牌管理', tabBarExtraContent: '操作',
        items: ['基础设置', '合作方管理', '合作方店铺管理', '合作分销商管理', '自动作业', '补拉申请'].map((label, index) => ({ key: String(index), label, children: '面板' + index, disabled: index === 4 })),
        ...extra,
      }));
    });
    for (const type of ['line', 'card', 'pill', 'capsule', 'underline', 'tech', 'tech-line']) {
      await page.evaluate(type => window.renderTabs(type, 1450), type);
      const more = page.getByRole('button', { name: '更多选项卡' });
      await page.waitForTimeout(150);
      assert.equal(await more.isVisible(), false, type + ' 宽容器不显示更多');
      assert.equal(await page.getByRole('tab').count(), 6);
      await page.evaluate(type => window.renderTabs(type, 560), type);
      await more.waitFor();
      assert.ok(await page.getByRole('tab').count() < 6);
      assert.equal(await page.locator('.sia-tabs__list').evaluate(el => getComputedStyle(el).overflowX), 'clip');
      const hiddenLabels = await page.locator('[data-tab-entry][data-tab-hidden="true"] .sia-tabs__tab').allTextContents();
      await more.hover();
      await page.getByRole('button', { name: '补拉申请', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '自动作业', exact: true }).isDisabled(), true);
      for (const label of hiddenLabels) assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1);
      await page.getByRole('button', { name: '补拉申请', exact: true }).click();
      await page.getByRole('tabpanel').filter({ hasText: '面板5' }).waitFor();
      assert.equal(await more.evaluate(el => el.classList.contains('is-active')), true);
      await page.mouse.move(1500, 900);
      await page.evaluate(type => window.renderTabs(type, 1450), type);
      await page.waitForTimeout(150);
      assert.equal(await more.isVisible(), false);
      assert.equal(await page.getByRole('tab', { name: '补拉申请' }).getAttribute('aria-selected'), 'true');
      console.log('PASS', type, '宽窄切换、悬停菜单、剩余项选择');
    }
    // 超长单项、键盘入口、右键菜单包装和动态删除仍沿用相同的宽度计算。
    await page.evaluate(() => window.renderTabs('tech-line', 220, { tabBarTitle: undefined, tabBarExtraContent: undefined, tabContextMenu: [{ key: 'refresh', label: '刷新' }] }));
    const more = page.getByRole('button', { name: '更多选项卡' });
    await more.waitFor();
    await more.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('button', { name: '补拉申请', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await more.evaluate(el => el === document.activeElement), true);
    await page.evaluate(() => window.renderTabs('tech-line', 220, { tabBarTitle: undefined, tabBarExtraContent: undefined, items: [{ key: 'short', label: '金额' }] }));
    await page.waitForTimeout(150);
    assert.equal(await more.isVisible(), false);
    assert.equal(await page.getByRole('tab').count(), 1);
    console.log('PASS 键盘打开与关闭、右键菜单包装、动态移除标签');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
