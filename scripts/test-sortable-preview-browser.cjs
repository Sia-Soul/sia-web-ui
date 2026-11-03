// 真实指针回归：拖动预览不提前提交，也不能重挂载含输入控件的卡片。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
const output = path.resolve('logs/sortable-preview');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: output, size: { width: 1440, height: 900 } } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(async source => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { SortableList } = await import(source + '/UtilityLayout.tsx');
      const { Card } = await import(source + '/Card.tsx');
      const { Input } = await import(source + '/Input.tsx');
      const { Form } = await import(source + '/Form.tsx');
      document.body.innerHTML = '<main style="padding:32px"><h2>编码分段拖动预览</h2><div id="fixture"></div></main>';
      window.orders = [];
      function Demo() {
        const [form] = Form.useForm();
        const [items, setItems] = React.useState(['甲', '乙', '丙', '丁']);
        const [disabled, setDisabled] = React.useState(false);
        const [direction, setDirection] = React.useState('horizontal');
        window.refreshFixture = () => setItems([...items]);
        window.setFixture = (next, disable = false, axis = 'horizontal') => { form.setFieldsValue({ rules: next.map(field => ({ field })) }); setItems(next); setDisabled(disable); setDirection(axis); window.orders = []; };
        window.readFields = () => form.getFieldValue('rules');
        return React.createElement(Form, { form, initialValues: { rules: ['甲','乙','丙','丁'].map(field => ({ field })) } }, React.createElement('div', { style: { width: '100%', maxWidth: 1300, maxHeight: 600, overflow: 'auto' } }, React.createElement(SortableList, {
          items, disabled, direction, handlePlacement: 'custom', handleContent: key => '编码' + key + '段',
          // 与编码规则页面一致：按旧稳定键重排表单数组，再同步新的键顺序。
          onOrderChange: next => { const current = form.getFieldValue('rules'); form.setFieldValue('rules', next.map(key => current[items.indexOf(key)])); window.orders.push(next); setItems(next); },
          renderItem: (key, index, handle) => React.createElement('div', { style: { width: 280 }, 'data-key': key }, React.createElement(Card, { title: handle },
            React.createElement('p', null, '长度、字段和类型跟随整张卡片移动'),
            React.createElement(Form.Item, { name: ['rules', index, 'field'] }, React.createElement(Input, { 'aria-label': '字段' + key })),
            React.createElement('p', null, '当前位置：' + (index + 1))))
        })));
      }
      createRoot(document.getElementById('fixture')).render(React.createElement(Demo));
    }, '/@fs/' + path.resolve(__dirname, '../packages/react/src/components').replace(/\\/g, '/'));
    const item = key => page.locator(`[data-key="${key}"]`);
    const start = async key => { const r = await item(key).getByRole('button', { name: /调整第/ }).boundingBox(); await page.mouse.move(r.x + 50, r.y + r.height / 2); await page.mouse.down(); return { x: r.x + 50, y: r.y + r.height / 2 }; };
    const reset = async (keys = ['甲','乙','丙','丁'], disabled = false, axis = 'horizontal') => { await page.evaluate(args => window.setFixture(...args), [keys, disabled, axis]); await page.waitForTimeout(220); };
    await page.getByRole('textbox', { name: '字段甲', exact: true }).fill('保留输入草稿');
    const before = await item('甲').boundingBox();
    const sibling = await item('乙').boundingBox();
    const p = await start('甲');
    await page.mouse.move(p.x + 100, p.y, { steps: 10 });
    await page.waitForTimeout(50);
    const moving = await item('甲').boundingBox();
    await page.screenshot({ path: path.join(output, 'following.png') });
    assert.ok(Math.abs(moving.x - before.x - 100) < 3, '卡片主体须实时跟随指针，不能仅显示浏览器拖动虚影');
    await page.mouse.move(p.x + 600, p.y);
    await page.waitForTimeout(50);
    const intermediate = (await item('乙').boundingBox()).x;
    assert.ok(intermediate < sibling.x && intermediate > before.x, '相邻卡片有中间动画帧，不直接跳位');
    await page.waitForTimeout(230);
    assert.ok((await item('乙').boundingBox()).x < sibling.x - 200, '松手前相邻卡片已平滑让位');
    assert.deepEqual(await page.evaluate(() => window.orders), [], '预览不提交');
    assert.equal(await page.getByRole('textbox', { name: '字段甲', exact: true }).inputValue(), '保留输入草稿');
    await page.screenshot({ path: path.join(output, 'preview.png') });
    await page.mouse.up();
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.orders), [['乙','丙','甲','丁']], '松手仅提交一次最终顺序');
    assert.deepEqual(await page.evaluate(() => window.readFields().map(rule => rule.field)), ['乙','丙','保留输入草稿','丁'], '表单索引和字段值随最终顺序对应');
    assert.equal(await page.getByRole('textbox', { name: '字段甲', exact: true }).inputValue(), '保留输入草稿');
    await page.screenshot({ path: path.join(output, 'dropped.png') });
    await reset();
    const cancel = await start('甲'); await page.mouse.move(cancel.x + 400, cancel.y, { steps: 10 }); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.orders), [], 'Esc 取消不提交');
    await reset(); const outside = await start('甲'); await page.mouse.move(outside.x + 350, outside.y + 500, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(220);
    assert.deepEqual(await page.evaluate(() => window.orders), [], '列表外松手不提交');
    await reset(); const stale = await start('甲'); await page.mouse.move(stale.x + 350, stale.y, { steps: 10 }); await page.evaluate(() => window.setFixture(['甲','乙','丁'])); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.orders), [], '外部数据变化取消旧拖动');
    await reset(undefined, true); const off = await start('甲'); await page.mouse.move(off.x + 400, off.y, { steps: 10 }); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.orders), [], '禁用不排序');
    await reset(); await item('甲').getByRole('button', { name: /调整第/ }).press('ArrowRight');
    assert.deepEqual(await page.evaluate(() => window.orders), [['乙','甲','丙','丁']], '键盘排序仍可用');
    await reset(undefined, false, 'vertical'); const v = await start('甲'); const vr = await item('乙').boundingBox(); await page.mouse.move(v.x, vr.y + vr.height / 2, { steps: 15 }); await page.mouse.up(); await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.orders.at(-1)), ['乙','甲','丙','丁'], '纵向排序');
    await reset(); await page.setViewportSize({ width: 780, height: 900 }); const scroll = await start('甲'); await page.mouse.move(735, scroll.y, { steps: 15 }); await page.waitForTimeout(700);
    assert.ok(await page.locator('.sia-sortable-list').evaluate(el => el.scrollLeft > 30), '窄屏边缘自动滚动');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.orders), [], '滚动取消不提交');
    await page.setViewportSize({ width: 1440, height: 900 }); await reset();
    const unchanged = await start('甲'); await page.mouse.move(unchanged.x + 10, unchanged.y); await page.mouse.up(); await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.orders), [], '原位释放不提交');
    await reset(); const disableDuring = await start('甲'); await page.mouse.move(disableDuring.x + 400, disableDuring.y); await page.evaluate(() => window.setFixture(['甲','乙','丙','丁'], true)); await page.mouse.up(); await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.orders), [], '拖动期间禁用取消旧顺序');
    await reset(); const refresh = await start('甲'); await page.mouse.move(refresh.x + 300, refresh.y); await page.evaluate(() => window.refreshFixture()); await page.mouse.up(); await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => window.orders), [['乙','甲','丙','丁']], '相同顺序的父级刷新不中断拖动');
    await reset(); const resize = await start('甲'); await page.mouse.move(resize.x + 300, resize.y); await page.setViewportSize({ width: 1200, height: 900 }); await page.mouse.up(); await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.orders), [], '尺寸变化取消旧几何预览');
    await page.setViewportSize({ width: 1440, height: 900 }); await reset();
    // 使用浏览器触摸输入，不用构造组件回调；确认移动设备也走同一排序流程。
    const cdp = await page.context().newCDPSession(page);
    const touch = await item('甲').getByRole('button', { name: /调整第/ }).boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x + 40, y: touch.y + 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x + 340, y: touch.y + 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => window.orders), [['乙','甲','丙','丁']], '触摸拖动提交一次');
    await reset(); await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await start('甲'); await page.mouse.move(reduced.x + 300, reduced.y); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.orders), [['乙','甲','丙','丁']], '减少动态效果直接提交');
    assert.deepEqual(errors, [], '无运行错误');
    await page.close(); await page.video().saveAs(path.join(output, 'regression.webm'));
    console.log('PASS 23 assertions: pointer follow, animation frames, preview, form values, cancellation, keyboard, vertical, edge scroll, rerender, resize, touch, reduced motion');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
