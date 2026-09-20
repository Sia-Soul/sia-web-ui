const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 拉伸触发器外层时，气泡仍应以内部名称按钮定位；靠近边缘时箭头继续指向按钮。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/popconfirm');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Popconfirm } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Feedback.tsx');
      const { Button } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Button.tsx');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const root = (dom.default ?? dom).createRoot(host);
      window.renderConfirm = (left, top, props = {}) => root.render(React.createElement('div', { style: { position: 'absolute', left, top, width: 700, display: 'grid', justifyItems: 'stretch' } },
        React.createElement(Popconfirm, { title: '谨慎！是否确认切换品牌方？', description: 'dev品牌方', ...props },
          React.createElement(Button, { variant: 'link' }, 'dev品牌方（12521362）'))));
      window.renderConfirm(200, 350);
    });
    const trigger = page.getByRole('button', { name: 'dev品牌方（12521362）' });
    await trigger.click();
    const overlay = page.locator('.sia-floating__overlay');
    await overlay.waitFor();
    await page.waitForTimeout(180);
    async function check(centered) {
      const a = await trigger.boundingBox(), b = await overlay.boundingBox();
      const arrow = await page.locator('.sia-floating__arrow').boundingBox();
      if (centered) assert.ok(Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 2, '气泡应在名称按钮正上方');
      assert.ok(Math.abs(a.x + a.width / 2 - arrow.x - arrow.width / 2) < 2, '箭头应指向名称按钮中心');
      assert.ok(b.x >= 7 && b.x + b.width <= 993, '气泡应保持在窗口内');
    }
    await check(true);
    // 滚动事件与容器重排触发重新定位。
    await page.evaluate(() => { window.renderConfirm(8, 350); window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(100);
    await check(false);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.evaluate(() => window.renderConfirm(200, 12));
    await trigger.click();
    await page.waitForTimeout(180);
    assert.ok((await overlay.getAttribute('class')).includes('overlay--bottom'), '顶部空间不足时向下避让');
    await check(true);
    // 无触发事件的初始打开，以及键盘焦点和悬停入口也使用子元素定位。
    for (const props of [{ key: 'initial', defaultOpen: true }, { key: 'focus', trigger: 'focus' }, { key: 'hover', trigger: 'hover' }]) {
      await page.evaluate(props => window.renderConfirm(200, 350, props), props);
      if (props.trigger === 'focus') await trigger.focus();
      if (props.trigger === 'hover') await trigger.hover();
      await overlay.waitFor();
      await page.waitForTimeout(180);
      await check(true);
    }
    console.log('PASS 名称按钮居中定位、窗口边缘箭头、顶部翻转、初始打开及焦点/悬停触发');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
