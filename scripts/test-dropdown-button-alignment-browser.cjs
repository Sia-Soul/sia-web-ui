/** 验证组合菜单对齐整组按钮，并保留主按钮独立操作与视口避让。 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/dropdown');
    await page.evaluate(async source => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Dropdown } = await import('/@fs/' + source + '/packages/react/src/index.ts');
      const host = document.createElement('div');
      host.id = 'alignment-fixture';
      host.style = 'position:fixed;left:80px;top:60px;z-index:10000;background:white';
      document.body.append(host);
      const root = createRoot(host);
      window.mainClicks = 0;
      window.renderAlignment = placement => root.render(React.createElement(Dropdown.Button, {
        placement, buttonProps: { variant: 'primary' },
        onClick: () => window.mainClicks++,
        menu: { items: [{ key: 'undo', label: '批量反核销' }] },
      }, '批量核销长标题'));
      window.renderAlignment(undefined);
    }, path.resolve(__dirname, '..').replaceAll('\\', '/'));
    const group = page.locator('#alignment-fixture .sia-dropdown-button');
    await group.getByRole('button', { name: '批量核销长标题', exact: true }).click();
    assert.equal(await page.evaluate(() => window.mainClicks), 1);
    await group.getByRole('button', { name: '展开下拉菜单' }).click();
    const popup = page.locator('.sia-dropdown__popup.is-open');
    await popup.waitFor();
    // 动画完成后读取最终位置，避免缩放过渡干扰几何测量。
    await page.waitForTimeout(250);
    let anchor = await group.boundingBox(), panel = await popup.boundingBox();
    assert(Math.abs(anchor.x - panel.x) < 2, '默认菜单必须对齐主按钮左侧');
    assert.equal(await page.evaluate(() => window.mainClicks), 1, '箭头不可触发主操作');
    await page.evaluate(() => window.renderAlignment('bottomRight'));
    await page.waitForTimeout(100);
    anchor = await group.boundingBox(); panel = await popup.boundingBox();
    assert(Math.abs(anchor.x + anchor.width - panel.x - panel.width) < 2, '显式右对齐使用整组右边缘');
    // 将组合按钮移到视口右侧，并用宽菜单验证自动避让。
    await page.evaluate(() => {
      window.renderAlignment('bottomLeft');
      const host = document.querySelector('#alignment-fixture');
      host.style.left = 'auto'; host.style.right = '5px';
    });
    await page.addStyleTag({ content: '.sia-dropdown__popup { min-width: 360px !important; }' });
    await page.waitForTimeout(150);
    panel = await popup.boundingBox();
    assert(panel.x >= 0 && panel.x + panel.width <= 1000, '空间不足时菜单应留在视口内');
    console.log('PASS 组合按钮左对齐、显式右对齐、主操作独立及视口避让');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
