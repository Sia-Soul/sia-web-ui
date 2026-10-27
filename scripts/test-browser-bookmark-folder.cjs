/** 使用虚构收藏验证栏内目录锚点、级联悬停、网站图标、空目录及完整收藏入口。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
// 支持隔离的测试服务端口，避免占用日常开发预览。
const baseUrl = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1440';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const failures = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.addInitScript(() => {
      window.folderTest = { calls: [], handlers: {} };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.folderTest.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        window.folderTest.calls.push({ name, args });
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return { version: 3, activeId: 'base', groups: [], showBookmarksBar: true,
          tabs: [{ id: 'base', title: '新标签页', url: '', groupId: 'group-root' }],
          bookmarkFolders: [{ id: 'work', title: '工作' }, { id: 'nested', title: '子目录', parentId: 'work' }, { id: 'deeper', title: '第二层目录', parentId: 'nested' }, { id: 'other', title: '其他' }, { id: 'empty', title: '空目录' }],
          bookmarks: [{ id: 'inside', title: '匹配工作', url: 'https://work.test', parentId: 'work' }, { id: 'deep', title: '匹配子目录', url: 'https://deep.test', parentId: 'deeper' }, { id: 'outside', title: '匹配其他', url: 'https://other.test', parentId: 'other' }, { id: 'root', title: '匹配根目录', url: 'https://root.test' }] };
      } } };
    });
    await page.goto(`${baseUrl}/`);
    const button = page.getByRole('navigation', { name: '收藏夹栏', exact: true }).getByRole('button', { name: '工作', exact: true });
    await button.waitFor();
    const rect = await button.boundingBox();
    await button.click();
    assert.ok(await button.evaluate(element => element.classList.contains('sia-button--link') && element.closest('.sia-dropdown')?.getAttribute('aria-expanded') === 'true'), '文件夹必须由 link 按钮触发受控 Dropdown');
    assert.ok(await page.getByRole('navigation', { name: '收藏夹栏', exact: true }).getByRole('button', { name: '匹配根目录', exact: true }).evaluate(element => element.classList.contains('sia-button--link') && !element.closest('.sia-dropdown')), '非文件夹必须使用独立 link 按钮');
    await page.waitForFunction(() => window.folderTest.calls.some(call => call.name === 'show_browser_panel'));
    const args = await page.evaluate(() => window.folderTest.calls.filter(call => call.name === 'show_browser_panel').at(-1).args);
    assert.ok(Math.abs(args.x - Math.max(20, rect.x)) < 2, '文件夹面板对齐按钮左侧，窗口边缘只保留阴影安全距离');
    assert.ok(args.y >= rect.y + rect.height && args.y <= rect.y + rect.height + 12, '面板必须紧贴按钮下方');
    assert.equal(args.payload.kind, 'bookmark-folder');
    assert.ok(args.payload.triggerBounds);
    // 原生 Escape/外部点击收起时，Dropdown 的无障碍展开状态必须跟随回传。
    await page.evaluate(() => window.folderTest.handlers['sia://browser-menu-visibility']({ payload: { visible: false } }));
    await page.waitForFunction(() => !document.querySelector('.bookmarks-bar .sia-dropdown.is-open'));
    await button.press('ArrowDown');
    await page.waitForFunction(() => document.querySelector('.bookmarks-bar .sia-dropdown.is-open'));
    await page.getByRole('navigation', { name: '收藏夹栏', exact: true }).getByRole('button', { name: '空目录', exact: true }).click();
    const empty = await page.evaluate(() => window.folderTest.calls.filter(call => call.name === 'show_browser_panel').at(-1).args.payload);
    assert.notEqual(empty.toggleKey, args.payload.toggleKey, '不同文件夹不能误判成重复点击关闭');
    await page.keyboard.press('Control+Shift+O');
    await page.waitForFunction(() => window.folderTest.calls.filter(call => call.name === 'show_browser_panel').at(-1).args.payload.kind === 'bookmarks');
    const full = await page.evaluate(() => window.folderTest.calls.filter(call => call.name === 'show_browser_panel').at(-1).args.payload);
    const menu = await browser.newPage({ viewport: { width: 1000, height: 780 } });
    await menu.addInitScript(payload => {
      window.menuTest = { payload, handlers: {}, calls: [] };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.menuTest.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        window.menuTest.calls.push({ name, args });
        if (name === 'get_browser_menu_state') return window.menuTest.payload;
      } } };
    // 原生层为级联菜单扩大透明画布，并把根菜单尺寸通过 menuLayout 传入。
    }, { ...args.payload, menuLayout: { left: 20, top: 20, width: args.width, height: args.height } });
    await menu.goto(`${baseUrl}/menu.html`);
    await menu.getByText('匹配工作', { exact: true }).waitFor();
    assert.equal(await menu.getByText('工作', { exact: true }).count(), 0, '不重复渲染目录自身');
    assert.equal(await menu.getByText('其他', { exact: true }).count(), 0);
    assert.equal(await menu.getByText('匹配根目录', { exact: true }).count(), 0);
    assert.equal(await menu.locator('.browser-panel__header').count(), 0, '目录菜单不显示完整收藏夹标题和工具栏');
    // 以整行按钮外沿测量四边留白，避免只检查 CSS padding 而漏掉行外边距和高度裁切。
    const insets = await menu.locator('.browser-window-menu').evaluate(root => {
      const outer = root.getBoundingClientRect();
      const rows = root.querySelectorAll('.sia-menu__item');
      const first = rows[0].getBoundingClientRect(), last = rows[rows.length - 1].getBoundingClientRect();
      return [first.top - outer.top, outer.right - first.right, outer.bottom - last.bottom, first.left - outer.left];
    });
    if (insets.some(value => Math.abs(value - 7) > 0.5)) failures.push(`根菜单四边应为 6px 内边距加 1px 边框，实际 ${insets}`);
    await menu.getByText('子目录', { exact: true }).hover();
    await menu.getByText('第二层目录', { exact: true }).waitFor();
    assert.ok(await menu.getByText('匹配工作', { exact: true }).isVisible(), '展开子目录时父菜单仍保留');
    const parentBounds = await menu.locator('.browser-window-menu').boundingBox();
    const childBounds = await menu.locator('.sia-menu__popup').boundingBox();
    if (childBounds.x - parentBounds.x - parentBounds.width < 8) failures.push('父子菜单边框之间应至少间隔 8px');
    const childInsets = await menu.locator('.sia-menu__popup').evaluate(root => {
      const outer = root.getBoundingClientRect();
      const row = root.querySelector('.sia-menu__item').getBoundingClientRect();
      return [row.top - outer.top, outer.right - row.right, outer.bottom - row.bottom, row.left - outer.left];
    });
    if (childInsets.some(value => Math.abs(value - 7) > 0.5)) failures.push(`子菜单四边留白不一致：${childInsets}`);
    await menu.getByText('第二层目录', { exact: true }).hover();
    await menu.getByText('匹配子目录', { exact: true }).waitFor();
    assert.equal(await menu.locator('.sia-menu__popup.is-open').count(), 2, '多级菜单同时保留两层');
    await menu.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/bookmark-folder-menu.png' });
    assert.ok(args.payload.items.some(item => item.faviconUrl === 'https://work.test'), '收藏携带网站图标地址');
    await menu.getByText('匹配子目录', { exact: true }).click();
    await menu.waitForFunction(() => window.menuTest.calls.some(call => call.name === 'browser_menu_action' && call.args.action.action === 'panel|bookmarks|open|deep'));
    // 靠近窗口右侧时反向展开，也必须按面板外沿保留间距。
    await menu.evaluate(value => window.menuTest.handlers['sia://browser-menu-state']({ payload: value }),
      { ...args.payload, menuLayout: { left: 650, top: 20, width: args.width, height: args.height } });
    await menu.getByText('子目录', { exact: true }).hover();
    await menu.getByText('第二层目录', { exact: true }).waitFor();
    const flippedParent = await menu.locator('.browser-window-menu').boundingBox();
    const flippedChild = await menu.locator('.sia-menu__popup.is-open').boundingBox();
    if (flippedParent.x - flippedChild.x - flippedChild.width < 8) failures.push('向左展开的父子菜单间距不足');
    // 切换原生面板载荷，验证空目录与完整入口的范围互不污染。
    for (const [payload, expected] of [[empty, '此文件夹为空'], [full, '匹配根目录']]) {
      await menu.evaluate(value => { window.menuTest.payload = value; }, payload);
      await menu.evaluate(value => window.menuTest.handlers['sia://browser-menu-state']({ payload: value }), payload);
      await menu.getByText(expected, { exact: true }).waitFor();
    }
    const longMenu = { ...empty, menuLayout: { left: 20, top: 20, width: 320, height: 240 },
      items: Array.from({ length: 50 }, (_, index) => ({ key: `long-${index}`, label: `长列表项目 ${index}` })) };
    await menu.evaluate(value => window.menuTest.handlers['sia://browser-menu-state']({ payload: value }), longMenu);
    await menu.getByText('长列表项目 49', { exact: true }).scrollIntoViewIfNeeded();
    assert.ok(await menu.locator('.browser-window-menu').evaluate(element => element.scrollHeight > element.clientHeight && element.scrollTop > 0), '长目录可滚动到末尾');
    // 收藏栏链接与面板链接都要创建新标签，已有标签不能被覆盖。
    await page.getByRole('navigation', { name: '收藏夹栏', exact: true }).getByRole('button', { name: '匹配根目录', exact: true }).click();
    await page.waitForFunction(() => window.folderTest.calls.some(call => call.name === 'open_browser_tab' && call.args.url === 'https://root.test'));
    const rootOpened = await page.evaluate(() => window.folderTest.calls.filter(call => call.name === 'open_browser_tab' && call.args.url === 'https://root.test').at(-1).args);
    if (rootOpened.tabId === 'base') failures.push('收藏栏链接覆盖了原标签');
    await page.evaluate(() => window.folderTest.handlers['sia://native-menu-action']({ payload: 'panel|bookmarks|open|deep' }));
    await page.waitForFunction(() => window.folderTest.calls.some(call => call.name === 'open_browser_tab' && call.args.url === 'https://deep.test'));
    const deepOpened = await page.evaluate(() => window.folderTest.calls.filter(call => call.name === 'open_browser_tab' && call.args.url === 'https://deep.test').at(-1).args);
    if (deepOpened.tabId === rootOpened.tabId || deepOpened.tabId === 'base') failures.push('收藏夹面板链接覆盖了原标签');
    if (!failures.some(value => value.includes('覆盖'))) {
      await page.waitForFunction(() => window.folderTest.calls.filter(call => call.name === 'save_browser_state').at(-1)?.args.state.tabs.length === 3);
      const saved = await page.evaluate(() => window.folderTest.calls.filter(call => call.name === 'save_browser_state').at(-1).args.state);
      assert.equal(saved.tabs.find(tab => tab.id === 'base').url, '', '原标签网址保持不变');
      assert.equal(saved.activeId, deepOpened.tabId, '新收藏标签自动激活');
      assert.equal(saved.tabs.find(tab => tab.id === rootOpened.tabId).groupId, saved.tabs.find(tab => tab.id === 'base').groupId, '新标签沿用当前分组');
    }
    assert.deepEqual(failures, []);
    console.log('PASS 四边留白、左右展开间距、收藏栏及面板新标签打开、原标签保留，以及目录级联回归');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
