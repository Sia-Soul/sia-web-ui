const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 挂载两个独立表单，验证自然标签测量、动态缩放和布局覆盖，避免仅检查样式声明。
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
      window.mountForm = (text = '最长的表单字段名称', layout = 'horizontal', width) => root.render(
        React.createElement('div', null, ...['first', 'second'].map(id => React.createElement(Form,
          { key: id, id, layout, style: width ? { '--sia-form-label-width': width } : undefined },
          React.createElement(Form.Item, { label: '名称' }, React.createElement(Input)),
          text ? React.createElement(Form.Item, { label: id === 'first' ? text : '地址', required: true }, React.createElement(Input)) : null,
        ))),
      );
    });
    const snapshot = () => page.evaluate(() => [...document.querySelectorAll('form')].map(form => ({
      auto: parseFloat(form.style.getPropertyValue('--sia-form-auto-label-width')),
      labels: [...form.querySelectorAll('.sia-form-item__label')].map(el => el.getBoundingClientRect().width),
      natural: [...form.querySelectorAll('.sia-form-item__label-content')].map(el => el.offsetWidth),
    })));
    await page.evaluate(() => window.mountForm());
    await page.waitForFunction(() => parseFloat(document.querySelector('#first')?.style.getPropertyValue('--sia-form-auto-label-width')) > 0);
    let sizes = await snapshot();
    assert.equal(sizes[0].labels[0], sizes[0].labels[1]);
    assert.equal(sizes[0].labels[0], Math.max(...sizes[0].natural));
    assert(sizes[0].auto > sizes[1].auto);
    await page.evaluate(() => window.mountForm('动态变化后更长的表单字段名称'));
    await page.waitForFunction(old => parseFloat(document.querySelector('#first').style.getPropertyValue('--sia-form-auto-label-width')) > old, sizes[0].auto);
    const bigger = (await snapshot())[0].auto;
    await page.evaluate(() => window.mountForm(null));
    await page.waitForFunction(old => parseFloat(document.querySelector('#first').style.getPropertyValue('--sia-form-auto-label-width')) < old, bigger);
    await page.evaluate(() => window.mountForm('较长的字段名称', 'horizontal', '180px'));
    await page.waitForFunction(() => document.querySelector('#first .sia-form-item__label').getBoundingClientRect().width === 180);
    await page.evaluate(() => window.mountForm('较长的字段名称', 'inline'));
    await page.waitForFunction(() => document.querySelector('#first').classList.contains('sia-form--inline'));
    sizes = await snapshot();
    assert.equal(sizes[0].labels[0], sizes[0].labels[1]);
    // 垂直及窄屏布局仍为标签在上、控件在下，不应被自动列宽改变。
    for (const layout of ['vertical', 'horizontal']) {
      await page.evaluate(layout => window.mountForm('较长的字段名称', layout), layout);
      if (layout === 'horizontal') await page.setViewportSize({ width: 500, height: 800 });
      await page.waitForFunction(() => {
        const item = document.querySelector('#first .sia-form-item');
        return item.querySelector('.sia-form-item__control').getBoundingClientRect().top > item.querySelector('.sia-form-item__label').getBoundingClientRect().top;
      });
    }
    console.log('PASS Form: longest label, independent forms, dynamic growth/removal, explicit width, inline/vertical/mobile layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
