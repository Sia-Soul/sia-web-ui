/** 在主界面与独立侧栏验证滚动条溢出、滑块拖动及展开/收缩切换，不使用真实会话。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const entry of ['index.html', 'tab-panel.html']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
      await page.addInitScript(entry => {
        // 主界面预览直接挂载 Tree；桌面主窗口则使用独立侧栏 WebView。
        if (entry === 'index.html') return;
        const groups = [{ id: 'a', name: '滚动测试', color: '#5548f6', smallGroups: [{ id: 's', name: '小分组' }] }];
        const tabs = Array.from({ length: 45 }, (_, i) => ({ id: `t${i}`, title: `测试标签 ${i}`, groupId: 'a', smallGroupId: 's', url: '' }));
        const payload = { groups, tabs, activeId: 't0', darkMode: false, panelExpanded: true, panelPinned: true, panelWidth: 292, collapsedGroupIds: [], collapsedSmallGroupIds: [] };
        window.scrollTest = { payload, update: null };
        window.__TAURI__ = { event: { listen: async (name, callback) => {
          if (name === 'sia://floating-tab-panel-state') window.scrollTest.update = callback;
          return () => {};
        } }, core: { invoke: async command => {
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return { version: 3, groups, tabs, activeId: 't0', verticalPanelPinned: true, bookmarks: [], history: [] };
          if (command === 'get_floating_tab_panel_state') return structuredClone(payload);
        } } };
      }, entry);
      await page.goto(`http://127.0.0.1:1440/${entry}`);
      if (entry === 'index.html') {
        const add = page.getByRole('button', { name: '新建标签页', exact: true }).first();
        for (let i = 0; i < 30; i++) await add.click();
      }
      const scroll = page.locator('.vertical-tab-tree__scroll');
      await scroll.waitFor();
      await scroll.hover();
      // 不依赖内部实现名称，先检查用户实际能看到的竖向轨道。
      await page.waitForFunction(() => [...document.querySelectorAll('.sia-scrollbar-track')].some(el => {
        const style = getComputedStyle(el);
        return el.getBoundingClientRect().height > 50 && style.opacity === '1' && style.display !== 'none';
      }), null, { timeout: 5000 });
      const track = page.locator('.sia-floating-scrollbar--vertical:not([hidden])');
      const thumb = track.locator('.sia-floating-scrollbar__thumb');
      const box = await thumb.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 5 });
      await page.mouse.up();
      assert.ok(await scroll.evaluate(el => el.scrollTop > 0), `${entry}: 滑块必须驱动滚动`);
      // 构造真实横向溢出，确认双向轨道独立可用，内容恢复后横向轨道自动移除。
      await scroll.evaluate(el => {
        const wide = document.createElement('div');
        wide.dataset.scrollTestWide = 'true';
        wide.style.cssText = 'width: 700px; height: 1px';
        el.prepend(wide);
      });
      await scroll.hover();
      const horizontal = page.locator('.sia-floating-scrollbar--horizontal:not([hidden])');
      await horizontal.waitFor();
      const horizontalBox = await horizontal.locator('.sia-floating-scrollbar__thumb').boundingBox();
      await page.mouse.move(horizontalBox.x + 10, horizontalBox.y + 5);
      await page.mouse.down();
      await page.mouse.move(horizontalBox.x + 80, horizontalBox.y + 5, { steps: 5 });
      await page.mouse.up();
      assert.ok(await scroll.evaluate(el => el.scrollLeft > 0), `${entry}: 横向滑块必须驱动滚动`);
      await scroll.evaluate(el => el.querySelector('[data-scroll-test-wide]').remove());
      await page.waitForFunction(() => !document.querySelector('.sia-floating-scrollbar--horizontal:not([hidden])'));
      if (entry === 'tab-panel.html') {
        await page.evaluate(() => {
          window.scrollTest.payload.panelExpanded = false;
          window.scrollTest.update({ payload: structuredClone(window.scrollTest.payload) });
        });
      } else await page.getByRole('button', { name: '收起标签面板', exact: true }).click();
      const compact = page.locator('.vertical-tab-tree__compact-scroll');
      await compact.waitFor();
      await compact.hover();
      await page.waitForFunction(() => document.querySelector('.vertical-tab-tree__compact-scroll')?.hasAttribute('data-sia-floating-scrollbar'));
      assert.ok(await track.isVisible(), `${entry}: 收缩后仍应有滚动条`);
      await page.mouse.wheel(0, 400);
      await page.waitForFunction(() => document.querySelector('.vertical-tab-tree__compact-scroll').scrollTop > 0);
      if (entry === 'tab-panel.html') {
        await page.evaluate(() => {
          window.scrollTest.payload.tabs = [];
          window.scrollTest.update({ payload: structuredClone(window.scrollTest.payload) });
        });
        await page.waitForFunction(() => document.querySelectorAll('.sia-floating-scrollbar:not([hidden])').length === 0);
      }
      await page.close();
    }
    console.log('PASS 主界面/独立侧栏双向溢出、拖动滑块、展开与收缩、无溢出隐藏');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
