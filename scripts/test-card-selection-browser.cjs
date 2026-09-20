/** 验证整卡选择、嵌套操作隔离、键盘和悬浮面板，使用文档站真实组件。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/card');
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Card, Button } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      const host = document.createElement('div');
      host.style = 'position:fixed;inset:0;background:white;z-index:9999;padding:60px';
      document.body.append(host);
      window.cardClicks = 0;
      const h = R.createElement;
      createRoot(host).render(h(Card, { selectable: true, 'aria-label': '测试卡片', style: { width: 400, height: 200 }, hoverActions: h(Button, { onClick: () => window.cardClicks++ }, '详情') }, h('p', null, '卡片正文')));
      const disabledHost = document.createElement('div');
      disabledHost.style = 'position:fixed;top:350px;left:60px;z-index:10000;background:white'; document.body.append(disabledHost);
      createRoot(disabledHost).render(h(Card, { selectable: true, disabled: true, 'aria-label': '禁用卡片' }, '禁用正文'));
    });
    const card = page.getByRole('checkbox', { name: '测试卡片' });
    const panel = card.locator('.sia-card__hover-actions');
    await card.waitFor();
    await page.mouse.move(0, 0);
    await panel.waitFor({ state: 'hidden' });
    await card.locator('p').click();
    assert.equal(await card.getAttribute('aria-checked'), 'true');
    assert.equal(await card.locator('.sia-card__selected-corner svg').count(), 1);
    // 图标包围盒的左下角必须位于三角形斜边内，避免勾被裁切。
    assert.equal(await card.locator('.sia-card__selected-corner').evaluate(n => {
      const corner = n.getBoundingClientRect(), icon = n.querySelector('svg').getBoundingClientRect();
      return icon.left - corner.left >= icon.bottom - corner.top && icon.right <= corner.right;
    }), true);
    await card.locator('p').click();
    assert.equal(await card.getAttribute('aria-checked'), 'false');
    assert.equal(await card.locator('.sia-card__selected-corner').count(), 0);
    await card.hover();
    await panel.waitFor({ state: 'visible' });
    await card.getByRole('button', { name: '详情' }).click();
    assert.equal(await card.getAttribute('aria-checked'), 'false');
    assert.equal(await page.evaluate(() => window.cardClicks), 1);
    await page.mouse.move(0, 0);
    await panel.waitFor({ state: 'hidden' });
    await card.focus(); await card.press('Space');
    assert.equal(await card.getAttribute('aria-checked'), 'true');
    await card.press('Enter');
    assert.equal(await card.getAttribute('aria-checked'), 'false');
    const disabled = page.getByRole('checkbox', { name: '禁用卡片' });
    await disabled.click({ force: true });
    assert.equal(await disabled.getAttribute('aria-checked'), 'false');
    console.log('PASS card toggle, nested action isolation, hover enter/leave, keyboard and disabled selection');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
