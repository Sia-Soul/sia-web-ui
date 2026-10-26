/** 使用独立侧栏和虚构资料验证快捷键、根标签拖放及拖动期间的布局稳定性。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 820 } });
    await page.addInitScript(() => {
      const payload = {
        groups: [{ id: 'a', name: '环境', color: '#5548f6', smallGroups: [{ id: 'sub', name: '小分组' }] }],
        tabs: [{ id: 'grouped', groupId: 'a', smallGroupId: 'sub' }, { id: 'root', groupId: 'group-root' }, { id: 'other', groupId: 'group-root' }]
          .map(tab => ({ ...tab, title: tab.id, url: '', loading: false })),
        activeId: 'root', darkMode: false, panelExpanded: true, panelPinned: true, panelWidth: 400,
        closedTabCount: 0, collapsedGroupIds: [], collapsedSmallGroupIds: [],
      };
      window.treeTest = { actions: [], payload };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        if (command === 'get_floating_tab_panel_state') return structuredClone(payload);
        if (command === 'floating_tab_panel_action') {
          window.treeTest.actions.push(args.action);
          if (args.action.action === 'move-tab') {
            const move = JSON.parse(args.action.value);
            const tab = payload.tabs.find(tab => tab.id === move.tabId);
            payload.tabs = payload.tabs.filter(tab => tab.id !== move.tabId);
            const before = payload.tabs.findIndex(tab => tab.id === move.beforeTabId);
            payload.tabs.splice(before < 0 ? payload.tabs.length : before, 0, { ...tab, groupId: move.groupId, smallGroupId: move.smallGroupId });
          }
        }
      } } };
    });
    await page.goto('http://127.0.0.1:1440/tab-panel.html');
    const row = id => page.locator(`[data-browser-tab-id="${id}"] .vertical-tree-tab__select`);
    await row('root').waitFor();
    if (process.argv.includes('--keyboard')) {
      await row('root').focus();
      for (const extras of [{ repeat: true }, { shiftKey: true }, { altKey: true }]) {
        await row('root').dispatchEvent('keydown', { key: 'w', ctrlKey: true, ...extras });
      }
      assert.equal(await page.evaluate(() => window.treeTest.actions.length), 0);
      await row('root').press('Control+w');
      assert.deepEqual(await page.evaluate(() => window.treeTest.actions), [{ action: 'shortcut', value: 'close-tab' }]);
    } else {
      const top = (await row('root').boundingBox()).y;
      await row('root').dispatchEvent('dragstart', { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
      assert.equal((await row('root').boundingBox()).y, top, '开始拖动时根级节点不能被提示文案挤动');
      await row('root').dispatchEvent('dragend');
      const group = page.locator('[data-drop-small-group="sub"]');
      await row('root').dragTo(group);
      await group.locator('[data-browser-tab-id="root"]').waitFor();
      await row('grouped').dragTo(page.locator('.vertical-tab-tree__root-tabs'));
      await page.locator('.vertical-tab-tree__root-tabs [data-browser-tab-id="grouped"]').waitFor();
      await row('grouped').dragTo(row('other'), { targetPosition: { x: 25, y: 2 } });
      await page.waitForFunction(() => window.treeTest.actions.length === 3);
      const moves = await page.evaluate(() => window.treeTest.actions.map(action => JSON.parse(action.value)));
      assert.equal(moves[0].smallGroupId, 'sub');
      assert.equal(moves[1].groupId, 'group-root');
      assert.equal(moves[2].beforeTabId, 'other');
      // 根列表为空时仍需生成可放置区域，并显示末尾插入线。
      await row('other').dragTo(group);
      await group.locator('[data-browser-tab-id="other"]').waitFor();
      await row('grouped').dragTo(group);
      await group.locator('[data-browser-tab-id="grouped"]').waitFor();
      const origin = await row('root').boundingBox();
      await page.mouse.move(origin.x + 20, origin.y + 10);
      await page.mouse.down();
      await page.mouse.move(origin.x + 35, origin.y + 18, { steps: 4 });
      const emptyRoot = page.locator('.vertical-tab-tree__root-tabs');
      await emptyRoot.waitFor();
      const destination = await emptyRoot.boundingBox();
      await page.mouse.move(destination.x + 30, destination.y + 10, { steps: 5 });
      await page.mouse.move(destination.x + 31, destination.y + 10);
      await emptyRoot.locator('.vertical-tree-drop-line').waitFor();
      await page.mouse.up();
      await emptyRoot.locator('[data-browser-tab-id="root"]').waitFor();
    }
    console.log('PASS 独立 Tree：' + (process.argv.includes('--keyboard') ? 'Ctrl+W 和修饰键保护' : '根标签布局稳定、拖入分组、移出分组及根级排序'));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
