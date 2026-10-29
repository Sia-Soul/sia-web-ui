// 使用真实浏览器验证错误提示的独立计时、渐隐、悬停及重新校验，避免只检查类名。
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
      import '../../packages/react/src/styles.css'; import '../../packages/react/src/components-extra.css';
      function App(){const [form]=Form.useForm();window.testForm=form;
        const [manual,setManual]=React.useState('手动错误');window.setManual=setManual;
        const [mounted,setMounted]=React.useState(true);window.setMounted=setMounted;
        return mounted && <main style={{width:600,padding:40}}><Form form={form}>
          <Form.Item name="name" label="名称" rules={[{required:true,message:'请输入名称'}]}><Input/></Form.Item>
          <Form.Item name="code" label="编码" rules={[{required:true,message:'请输入编码'}]}><Input/></Form.Item>
          <Form.Item label="手动" validateStatus="error" help={manual}><Input/></Form.Item>
        </Form></main>;
      } createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
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
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const input = page.locator('[data-sia-form-field="name"] input');
    await input.waitFor();
    await page.mouse.move(1000, 700);
    const opacity = () => input.evaluate(node => getComputedStyle(document.getElementById(node.getAttribute('aria-errormessage')).closest('[role="alert"]')).opacity);
    const validate = () => page.evaluate(() => window.testForm.validateFields().catch(() => {}));
    const visible = async () => { await page.waitForFunction(() => {
      const node = document.querySelector('[data-sia-form-field="name"] input');
      const error = document.getElementById(node.getAttribute('aria-errormessage'));
      return error && getComputedStyle(error.closest('[role="alert"]')).opacity === '1';
    }); };
    await validate();
    await visible();
    await page.waitForTimeout(1300);
    assert.equal(await opacity(), '1', '提示保持显示，不能立即隐藏');
    // 其他字段更新不能续期当前字段；焦点保留在当前字段也不能阻止自动收起。
    await input.focus();
    await page.evaluate(() => window.testForm.setFieldValue('code', '其他字段变化'));
    await page.waitForTimeout(1000);
    assert.equal(await opacity(), '0', '两秒后隐藏且不受其他字段或焦点影响');
    assert.equal(await input.getAttribute('aria-invalid'), 'true');
    assert.equal(await input.evaluate(node => document.getElementById(node.getAttribute('aria-errormessage')).textContent), '请输入名称');
    await input.hover();
    await visible();
    await page.mouse.move(1000, 700);
    await page.waitForTimeout(60);
    assert.ok(Number(await opacity()) > 0 && Number(await opacity()) < 1, '离开时必须渐隐');
    await page.waitForTimeout(200);
    assert.equal(await opacity(), '0');
    // 相同错误重复提交也重新提示，前一次计时不能提前关闭后一次提示。
    await validate();
    await visible();
    await page.waitForTimeout(1200);
    await validate();
    await page.waitForTimeout(1100);
    assert.equal(await opacity(), '1', '重复提交重置两秒计时');
    await input.hover();
    await page.waitForTimeout(1200);
    assert.equal(await opacity(), '1', '到时仍在悬停则保持可见');
    await page.mouse.move(1000, 700);
    await page.waitForTimeout(250);
    assert.equal(await opacity(), '0');
    await page.evaluate(() => window.testForm.setFields([{name:'name',errors:['接口返回错误']}]));
    await visible();
    await input.fill('已修正');
    await page.waitForFunction(() => !document.querySelector('[data-sia-form-field="name"] input').hasAttribute('aria-errormessage'));
    // 手动错误也遵循相同时序，提示内容变化后重新显示。
    const manual = page.getByText('手动错误', {exact:true});
    assert.equal(await manual.evaluate(node => getComputedStyle(node.closest('[role="alert"]')).opacity), '0');
    await page.evaluate(() => window.setManual('新的手动错误'));
    await page.waitForTimeout(250);
    assert.equal(await page.getByText('新的手动错误', {exact:true}).evaluate(node => getComputedStyle(node.closest('[role="alert"]')).opacity), '1');
    await page.evaluate(() => window.testForm.resetFields());
    assert.equal(await input.getAttribute('aria-invalid'), null);
    await page.evaluate(() => window.setMounted(false));
    await page.waitForTimeout(2200);
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS 两秒自动渐隐、焦点及其他字段隔离、悬停重显、真实过渡、重复校验重计时、接口和手动错误、修正清除、重置与卸载。');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
