/** 使用虚构长目录复现快速切换子菜单与浮动滚动条；仅启动无界面浏览器。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
    await page.addInitScript(() => {
      window.menuTest = { calls: [] };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (name, args) => {
        window.menuTest.calls.push({ name, args });
        if (name === 'get_browser_menu_state') return {
          kind: 'bookmark-folder', hitRegionRevision: 1,
          menuLayout: { left: 20, top: 20, width: 280, height: 600 },
          items: Array.from({ length: 35 }, (_, folder) => ({ key: `folder-${folder}`, label: `目录 ${folder}`, folder: true,
            children: Array.from({ length: folder % 3 === 0 ? 40 : 2 + folder * 3 }, (_, index) => ({ key: `link-${folder}-${index}`, label: `收藏 ${folder}-${index}`,
              children: folder === 0 && index === 0 ? Array.from({ length: 40 }, (_, leaf) => ({ key: `deep-${leaf}`, label: `深层收藏 ${leaf}` })) : undefined,
            })),
          })),
        };
      } } };
    });
    await page.goto(`${process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1457'}/menu.html`);
    await page.getByText('目录 0', { exact: true }).hover();
    await page.getByText('收藏 0-0', { exact: true }).waitFor();
    // 逐次采样 DOM 提交，不能仅等待关闭延迟结束后断言最终状态。
    await page.evaluate(() => {
      window.menuTest.maxSiblingPopups = 0;
      new MutationObserver(() => {
        const count = document.querySelectorAll('.sia-menu__popup.is-open').length;
        window.menuTest.maxSiblingPopups = Math.max(window.menuTest.maxSiblingPopups, count);
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    });
    // 同帧切换后保留关闭计时器，验证旧回调不会重新打开已离开的目录。
    const points = await page.locator('.browser-window-menu .sia-menu__item').evaluateAll(items => items.slice(1, 7).map(item => {
      const rect = item.getBoundingClientRect();
      return { x: rect.x + 30, y: rect.y + rect.height / 2 };
    }));
    for (const point of points) await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(350);
    const popups = await page.locator('.sia-menu__popup.is-open').count();
    const scrollbars = await page.locator('[data-sia-floating-scrollbar]').count();
    console.log({ popups, scrollbars });
    assert.equal(popups, 1, '快速划过多个目录后只保留当前子菜单，不残留重叠浮层');
    assert.equal(await page.evaluate(() => window.menuTest.maxSiblingPopups), 1, '切换过程也不能同时显示多个同级子菜单');
    assert.ok(scrollbars >= 2, '根目录和子目录均须接入框架浮动滚动条');
    const list = page.locator('.sia-menu__popup.is-open .sia-menu__popup-list');
    assert.equal(await list.evaluate(element => getComputedStyle(element).scrollbarWidth), 'none');
    await page.getByText('收藏 6-0', { exact: true }).hover();
    await page.screenshot({ path: 'logs/browser-menu-floating-scrollbars.png' });
    const tracks = page.locator('.sia-floating-scrollbar--vertical:not([hidden])');
    const track = tracks.last();
    await page.waitForFunction(() => document.querySelectorAll('.sia-floating-scrollbar--visible:not([hidden])').length > 0);
    const thumb = await track.locator('.sia-floating-scrollbar__thumb').boundingBox();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2 + 120, { steps: 6 });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.sia-menu__popup.is-open').count(), 1, '拖动浮动滚动条不能关闭子菜单');
    assert.ok(await list.evaluate(element => element.scrollTop > 0), '浮动滑块能够滚动子目录');
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.menuTest.calls.filter(call => call.name === 'close_browser_menu').length), 0);
    // 回到父目录后让子层自然收起；移出全部菜单后根滚动条也应隐藏。
    await page.getByText('目录 6', { exact: true }).hover();
    await page.mouse.move(950, 750);
    await page.waitForFunction(() => !document.querySelector('.sia-menu__popup.is-open'));
    await page.waitForFunction(() => !document.querySelector('.sia-floating-scrollbar--visible:not([hidden])'));
    assert.equal(await page.locator('.browser-window-menu').evaluate(element => {
      const style = getComputedStyle(element);
      return element.offsetWidth - element.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    }), 0, '浮动滚动条不占用菜单布局宽度');
    await page.getByText('目录 0', { exact: true }).hover();
    await page.getByText('收藏 0-0', { exact: true }).hover();
    await page.getByText('深层收藏 0', { exact: true }).hover();
    const deepThumb = await page.locator('.sia-floating-scrollbar--vertical:not([hidden])').last().locator('.sia-floating-scrollbar__thumb').boundingBox();
    await page.mouse.move(deepThumb.x + 5, deepThumb.y + 10);
    await page.mouse.down();
    await page.mouse.move(deepThumb.x + 5, deepThumb.y + 100, { steps: 6 });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.sia-menu__popup.is-open').count(), 2, '拖动深层滑块时所有祖先菜单保持展开');
    await page.mouse.up();
    // 离开整个分支后清除后代状态，重新进入父目录不能自动恢复旧的孙级菜单。
    await page.getByText('目录 1', { exact: true }).hover();
    assert.equal(await page.locator('.sia-menu__popup.is-open').count(), 1);
    await page.getByText('目录 0', { exact: true }).hover();
    assert.equal(await page.locator('.sia-menu__popup.is-open').count(), 1);
    assert.equal(await page.locator('[data-menu-key="link-0-0"]').getAttribute('aria-expanded'), 'false');
    console.log('PASS 不同高度菜单切换逐次无重叠、旧分支后代清理、两级浮动滚动条与滑块拖动');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
