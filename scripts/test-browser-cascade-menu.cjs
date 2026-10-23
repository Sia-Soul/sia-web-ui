/** 验证悬停级联菜单保留主面板、左右避让、跨面板移动与叶子动作，不操作真实标签。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const side of ['right', 'left']) {
      const page = await browser.newPage({ viewport: { width: 628, height: 534 } });
      await page.addInitScript(side => {
        const payload = { kind: 'menu', darkMode: side === 'left', menuLayout: { left: side === 'right' ? 20 : 304, top: 20, width: 304, height: 494 }, items: [
          { key: 'new', label: '在下方新建标签页' },
          { key: 'move', label: '移动到', children: [{ key: 'move-local', label: '本地', disabled: true }, { key: 'move-dev', label: 'DEV环境' }, { key: 'move-pre', label: 'PRE环境' }] },
          { type: 'divider' }, { key: 'reload', label: '刷新', shortcut: 'Ctrl+R' },
        ] };
        window.cascadeTest = { calls: [] };
        window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
          window.cascadeTest.calls.push({ command, args });
          if (command === 'get_browser_menu_state') return structuredClone(payload);
        } } };
      }, side);
      await page.goto('http://127.0.0.1:1440/menu.html');
      const move = page.getByRole('button', { name: '移动到', exact: true });
      await move.waitFor();
      const root = page.locator('.browser-window-menu');
      const before = await root.boundingBox();
      await move.hover();
      const child = page.getByRole('button', { name: 'DEV环境', exact: true });
      await child.waitFor({ timeout: 5000 });
      assert.ok(await page.getByRole('button', { name: '刷新 Ctrl+R' }).isVisible());
      assert.deepEqual(await root.boundingBox(), before, '展开子菜单不能移动或替换主菜单');
      const popup = page.locator('.sia-menu__popup.is-open');
      const bounds = await popup.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 628);
      assert.ok(side === 'right' ? bounds.x >= before.x + before.width - 12 : bounds.x + bounds.width <= before.x + 12, '子菜单应在父菜单旁边避让');
      await child.hover();
      await page.waitForTimeout(180);
      assert.ok(await child.isVisible(), '从父项移入子面板后不能立即收起');
      assert.ok(await page.getByRole('button', { name: '本地', exact: true }).isDisabled());
      // Escape 只收起当前子菜单，再悬停可以重新展开。
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.sia-menu__popup.is-open'));
      await move.hover();
      await child.click();
      await page.waitForFunction(() => window.cascadeTest.calls.some(call => call.command === 'browser_menu_action'));
      assert.deepEqual(await page.evaluate(() => window.cascadeTest.calls.filter(call => call.command === 'browser_menu_action').map(call => call.args.action.action)), ['move-dev']);
      await page.close();
    }
    console.log('PASS 悬停展开级联菜单、父菜单保留、左右翻转、跨面板移动、Escape、禁用项和叶子动作');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
