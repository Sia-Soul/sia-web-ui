// 检查背景层实际位移和最终对齐，确保动画不延迟选中语义，并覆盖快速转向及减少动态效果。
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(`${process.env.DOCS_TEST_URL || 'http://127.0.0.1:4173'}/components/menu`);
    const vertical = page.locator('.menu-slide-vertical');
    await vertical.waitFor();
    const indicator = vertical.locator(':scope > .sia-menu__selection');
    const before = await indicator.boundingBox();
    await vertical.getByRole('button', { name: '偏好设置' }).click();
    assert.equal(await vertical.getByRole('button', { name: '偏好设置' }).getAttribute('aria-current'), 'page');
    const intermediate = await indicator.evaluate(node => {
      const animation = node.getAnimations()[0];
      if (!animation) return null;
      animation.pause(); animation.currentTime = 90;
      return { y: node.getBoundingClientRect().y, frames: animation.effect.getKeyframes() };
    });
    assert.ok(intermediate, '选中项变化应启动背景位移动画');
    const destination = await vertical.getByRole('button', { name: '偏好设置' }).boundingBox();
    assert.ok(intermediate.y > before.y && intermediate.y < destination.y, '背景应位于旧项与新项之间');
    assert.equal(intermediate.frames.length, 2);
    await indicator.evaluate(node => node.getAnimations().forEach(animation => animation.play()));
    await vertical.getByRole('button', { name: '项目管理' }).click();
    await vertical.getByRole('button', { name: '概览', exact: true }).click();
    await page.waitForTimeout(310);
    for (const selector of ['.menu-slide-vertical', '.menu-slide-horizontal', '.menu-slide-dark', '.menu-slide-grid']) {
      const root = page.locator(selector);
      const item = await root.locator('[aria-current="page"]').boundingBox();
      const marker = await root.locator(':scope > .sia-menu__selection').boundingBox();
      for (const dimension of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(item[dimension] - marker[dimension]) < 1, `${selector} ${dimension} 对齐`);
      assert.equal(await root.locator('[aria-current="page"]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    }
    // 改变尺寸只重新定位，不重播选中动画。
    await vertical.evaluate(node => node.style.width = '300px');
    await page.waitForTimeout(60);
    assert.equal(await indicator.evaluate(node => node.getAnimations().length), 0);
    assert.ok(Math.abs((await indicator.boundingBox()).width - (await vertical.locator('[aria-current="page"]').boundingBox()).width) < 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await vertical.getByRole('button', { name: '偏好设置' }).click();
    assert.equal(await indicator.evaluate(node => node.getAnimations().length), 0);
    if (process.env.MENU_MOTION_SCREENSHOT) await page.locator('.menu-slide-dark').screenshot({ path: process.env.MENU_MOTION_SCREENSHOT });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const nested = page.locator('.sia-menu__submenu').filter({ has: page.getByRole('button', { name: '产品列表', exact: true }) });
    await nested.getByRole('button', { name: '产品列表', exact: true }).click();
    await nested.getByRole('button', { name: '分类管理', exact: true }).click();
    assert.ok(await nested.locator(':scope > .sia-menu__selection').evaluate(node => node.getAnimations().length > 0), '内嵌子菜单同层滑动');
    await page.goto(`${process.env.DOCS_TEST_URL || 'http://127.0.0.1:4173'}/components/property-examples?component=Menu&group=NavigationExamples`);
    const preview = page.locator('#property-example-preview');
    const multi = preview.locator('.sia-menu--inline');
    await multi.getByRole('button', { name: '编辑', exact: true }).click();
    await multi.getByRole('button', { name: '复制', exact: true }).click();
    assert.equal(await multi.locator('[aria-current="page"]').count(), 2, '多选独立保留');
    assert.equal(await multi.locator('[data-sia-menu-highlight]').count(), 0, '多选使用独立背景');
    const scrolling = preview.getByRole('menu', { name: '自动定位网格菜单' });
    await preview.getByRole('button', { name: '定位末项' }).click();
    await page.waitForTimeout(310);
    const selectedBox = await scrolling.locator('[aria-current="page"]').boundingBox();
    const indicatorBox = await scrolling.locator(':scope > .sia-menu__selection').boundingBox();
    assert.ok(Math.abs(selectedBox.y - indicatorBox.y) < 1, '自动滚动后背景继续对齐');
    console.log('PASS Menu 背景位移、快速转向、横纵/深色/网格/子菜单对齐、多选、自动滚动、尺寸变化和减少动态效果。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
