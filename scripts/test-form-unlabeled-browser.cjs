// 无标签字段必须填满表单项，覆盖有标签邻项、纯无标签表单、窄屏及校验后的布局。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright-core'));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto('http://127.0.0.1:4173/components/form');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Form } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Form.tsx');
      const { Input } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Input.tsx');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const root = createRoot(host);
      window.mountUnlabeled = (layout, withLabel) => root.render(React.createElement(Form, { layout },
        withLabel && React.createElement(Form.Item, { label: '用于比较的较长标签' }, React.createElement(Input)),
        React.createElement(Form.Item, { name: 'scope', rules: [{ required: true, message: '请选择范围' }] }, React.createElement(Input)),
      ));
    });
    for (const width of [1400, 500]) {
      await page.setViewportSize({ width, height: 900 });
      for (const layout of ['horizontal', 'vertical']) {
        for (const withLabel of [true, false]) {
          await page.evaluate(args => window.mountUnlabeled(...args), [layout, withLabel]);
          await page.waitForFunction(() => {
            const item = document.querySelector('[data-sia-form-field="scope"]');
            const control = item?.querySelector('.sia-form-item__control');
            return item && Math.abs(item.getBoundingClientRect().width - control.getBoundingClientRect().width) < 1;
          });
          const input = page.locator('[data-sia-form-field="scope"] input');
          await input.fill('测试');
          await input.fill('');
          const bounds = await page.locator('[data-sia-form-field="scope"]').evaluate(item => ({
            item: item.getBoundingClientRect().width,
            control: item.querySelector('.sia-form-item__control').getBoundingClientRect().width,
            overflow: item.scrollWidth > item.clientWidth,
          }));
          assert(Math.abs(bounds.item - bounds.control) < 1);
          assert.equal(bounds.overflow, false);
        }
      }
    }
    console.log('PASS Form 无标签字段：横向/纵向、有标签邻项/纯无标签、宽窄屏、输入清空后不缩窄。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
