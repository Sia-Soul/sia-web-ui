// 校验气泡不得改变表单布局；覆盖经过隐藏、键盘避让、恢复、普通提示隔离及错误重置。
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const { build } = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite', { paths: [path.join(root, 'apps/docs')] }))] }));
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const bundle = await build({
    stdin: { resolveDir: path.join(root, 'apps/docs'), loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {Form} from '../../packages/react/src/components/Form';
      import {Input} from '../../packages/react/src/components/Input';
      import {Tooltip,Popover} from '../../packages/react/src/components/FloatingDisplay';
      import '../../packages/react/src/styles.css'; import '../../packages/react/src/components-extra.css';
      function App(){const [form]=Form.useForm();window.testForm=form;
        return <main style={{maxWidth:620,padding:16,paddingTop:160}}><Form form={form}>
          <Form.Item name="brand" label="品牌方名称"><Input disabled aria-label="品牌方名称"/></Form.Item>
          <Form.Item name="phone" label="手机号"><Input aria-label="手机号"/></Form.Item>
          <Form.Item name="address" label="地址"><Input aria-label="地址"/></Form.Item>
        </Form><Tooltip open trigger={[]} placement="bottom-start" title="普通提示"><button id="normal">普通气泡</button></Tooltip>
        <div style={{marginTop:100}}><Popover open trigger={[]} placement="bottom-start" content="普通浮层内容"><button>普通浮层</button></Popover></div></main>;
      } createRoot(document.getElementById('root')).render(<App/>);
    ` }, bundle: true, write: false, outdir: 'out', format: 'iife', jsx: 'automatic',
  });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${js}</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('textbox', { name: '地址', exact: true }).waitFor();
    for (const width of [1000, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.locator('#normal').focus();
      await page.mouse.move(width - 1, 799);
      const before = await page.locator('input').evaluateAll(inputs => inputs.map(input => input.getBoundingClientRect().top));
      await page.evaluate(() => window.testForm.setFields([
        { name: 'brand', errors: ['请输入服务号，回车查询品牌方；请确认服务号填写完整后重试。'] },
        { name: 'phone', errors: ['请输入手机号'] },
      ]));
      await page.getByRole('alert').first().waitFor();
      // 报错前后的实际输入位置必须完全一致，不能用增加间距或占位来解决遮挡。
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(await page.locator('input').evaluateAll(inputs => inputs.map(input => input.getBoundingClientRect().top)), before);
      // 留存最终真实组件效果，前后使用相同视口和输入内容。
      if (process.env.FORM_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.FORM_SCREENSHOT_DIR, `form-${width}-below.png`)});
      for (const [current, next] of [['brand', 'phone'], ['phone', 'address']]) {
        const measured = await page.evaluate(({ current, next }) => {
          const input = document.querySelector(`[data-sia-form-field="${current}"] input`);
          const error = document.getElementById(input.getAttribute('aria-errormessage'));
          const nextInput = document.querySelector(`[data-sia-form-field="${next}"] input`);
          const bounds = error.getBoundingClientRect();
          const nextBounds = nextInput.getBoundingClientRect();
          return { x: bounds.left + 8, y: bounds.top + 3, nextId: nextInput.id, errorTop: bounds.top,
            clickX: Math.max(bounds.left, nextBounds.left) + 5,
            clickY: (Math.max(bounds.top, nextBounds.top) + Math.min(bounds.bottom, nextBounds.bottom)) / 2,
            overlap: bounds.bottom > nextBounds.top && bounds.top < nextBounds.bottom,
            overflow: document.documentElement.scrollWidth > innerWidth, errorId: error.id };
        }, { current, next });
        assert.equal(measured.overflow, false);
        await page.mouse.move(measured.x, measured.y);
        await page.waitForFunction(({errorId}) => getComputedStyle(document.getElementById(errorId).closest('[role="alert"]')).opacity === '0', measured);
        // 气泡不向上一行移动；透明时仍有原始尺寸，连续移动也不会反复出现。
        for (let index=0;index<6;index++) {
          await page.mouse.move(measured.x + index, measured.y);
          assert.equal(await page.evaluate(({errorId}) => getComputedStyle(document.getElementById(errorId).closest('[role="alert"]')).opacity, measured), '0');
        }
        assert.ok(Math.abs(await page.evaluate(({errorId})=>document.getElementById(errorId).getBoundingClientRect().top,measured)-measured.errorTop)<1);
        if (process.env.FORM_SCREENSHOT_DIR && current==='brand') await page.screenshot({path:path.join(process.env.FORM_SCREENSHOT_DIR, `form-${width}-hidden.png`)});
        if (measured.overlap) {
          await page.mouse.click(measured.clickX, measured.clickY);
          assert.equal(await page.evaluate(() => document.activeElement.id), measured.nextId);
        }
        await page.mouse.move(width - 1, 799);
        if (measured.overlap) {
          // 输入焦点仍在遮挡区时继续隐藏，鼠标离开不能重新盖住正在编辑的控件。
          await page.waitForFunction(({errorId}) => getComputedStyle(document.getElementById(errorId).closest('[role="alert"]')).opacity === '0', measured);
        }
        await page.locator('#normal').focus();
        await page.waitForFunction(({errorId}) => getComputedStyle(document.getElementById(errorId).closest('[role="alert"]')).opacity === '1', measured);
        if (measured.overlap) {
          // 不经过气泡的键盘聚焦也能避让。
          await page.locator(`[id="${measured.nextId}"]`).focus();
          await page.waitForFunction(({errorId}) => getComputedStyle(document.getElementById(errorId).closest('[role="alert"]')).opacity === '0', measured);
          await page.locator('#normal').focus();
          await page.waitForFunction(({errorId}) => getComputedStyle(document.getElementById(errorId).closest('[role="alert"]')).opacity === '1', measured);
        }
      }
      if (process.env.FORM_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.FORM_SCREENSHOT_DIR, `form-${width}-restored.png`)});
      // 普通 Tooltip / Popover 即便经过内容也保持可见和原位置。
      for (const title of ['普通提示','普通浮层内容']) {
      const ordinary = page.getByText(title, {exact:true});
      const normalBefore = await ordinary.boundingBox();
      await page.mouse.move(normalBefore.x + 4, normalBefore.y + 4);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(await ordinary.boundingBox(), normalBefore);
      assert.equal(await ordinary.evaluate(node=>getComputedStyle(node.closest('.sia-floating__overlay')).opacity),'1');
      }
      await page.getByRole('textbox', { name: '手机号', exact: true }).fill('13800000000');
      await page.getByRole('textbox', { name: '地址', exact: true }).fill('可操作');
      await page.evaluate(() => window.testForm.setFields([{ name: 'brand', errors: [] }, { name: 'phone', errors: [] }]));
      await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
      await page.evaluate(() => window.testForm.setFields([{name:'brand',errors:['重新出现的错误']} ]));
      await page.waitForFunction(() => {
        const input=document.querySelector('[data-sia-form-field="brand"] input');
        const error=document.getElementById(input.getAttribute('aria-errormessage'));
        return error && error.getBoundingClientRect().top >= input.getBoundingClientRect().bottom;
      });
      await page.evaluate(() => window.testForm.setFields([{name:'brand',errors:[]} ]));
      await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
    }
    if (process.env.FORM_SCREENSHOT) {
      await page.evaluate(() => window.testForm.setFields([{ name: 'brand', errors: ['请输入服务号，回车查询品牌方'] }, { name: 'phone', errors: ['请输入手机号'] }]));
      await page.getByRole('alert').first().waitFor();
      await page.screenshot({ path: process.env.FORM_SCREENSHOT });
    }
    console.log('PASS 表单错误气泡：宽窄屏不占位、经过透明且不上移、连续移动不闪烁、焦点避让、离开恢复、点击穿透及普通气泡隔离。');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
