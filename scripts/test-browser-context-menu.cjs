/** 检查自定义菜单、透明边距及 Portal 的右键接收边界，不接触用户网页资料。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 500 } });
    await page.addInitScript(() => {
      window.menuTest = { actions: [] };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        if (command === 'get_browser_menu_state') return { kind: 'menu', darkMode: false, items: [{ key: 'reload', label: '刷新测试标签' }] };
        if (command === 'browser_menu_action') window.menuTest.actions.push(args);
      } } };
    });
    await page.goto('http://127.0.0.1:1440/menu.html');
    await page.getByText('刷新测试标签', { exact: true }).waitFor();
    const result = await page.evaluate(() => {
      const portal = document.createElement('div');
      portal.textContent = '独立弹层';
      document.body.append(portal);
      let customEvents = 0;
      portal.addEventListener('contextmenu', () => customEvents++);
      const targets = [document.querySelector('.browser-window-menu'), document.body, document.documentElement, portal];
      // 菜单已打开后反复右键，包含阴影留白及直接挂载到 body 的弹层。
      const prevented = targets.map(target => Array.from({ length: 3 }, () => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      }));
      portal.remove();
      return { prevented, customEvents };
    });
    assert.ok(result.prevented.flat().every(Boolean), JSON.stringify(result));
    assert.equal(result.customEvents, 3, '不能阻断业务自定义右键处理');
    // 真实右键连续点击菜单周围的透明留白，随后左键菜单动作仍能发给主窗口。
    await page.evaluate(() => {
      window.menuTest.rightClicks = [];
      document.addEventListener('contextmenu', event => window.menuTest.rightClicks.push(event.defaultPrevented));
    });
    await page.mouse.click(4, 4, { button: 'right' });
    await page.mouse.click(4, 4, { button: 'right' });
    assert.deepEqual(await page.evaluate(() => window.menuTest.rightClicks), [true, true]);
    await page.getByText('刷新测试标签', { exact: true }).click();
    await page.waitForFunction(() => window.menuTest.actions.length === 1);
    // 外壳的 document 监听不能影响独立网页文档，网页保留自己的默认及自定义右键行为。
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.srcdoc = '<p>网页内容</p>';
      document.body.append(frame);
    });
    const frame = page.frames().find(item => item !== page.mainFrame());
    await frame.waitForSelector('p');
    assert.equal(await frame.evaluate(() => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }), false);
    console.log('PASS 菜单重复右键、透明留白及 Portal 阻止默认菜单；业务事件和独立网页文档不受阻断');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
