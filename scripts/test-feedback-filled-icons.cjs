// 真实 Edge 验证提示状态采用实心图标，保留关闭、加载、自定义节点和原显隐规则。
const assert = require('node:assert/strict'), path = require('node:path'), http = require('node:http'), fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const { build } = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite', { paths: [path.join(root, 'apps/docs')] }))] }));
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';import{createRoot}from'react-dom/client';
    import{Alert}from'../../packages/react/src/components/Alert';import{message}from'../../packages/react/src/components/Message';
    import{Modal}from'../../packages/react/src/components/Modal';import{Result}from'../../packages/react/src/components/Result';
    import{notification,Popconfirm}from'../../packages/react/src/components/Feedback';import{Icon}from'../../packages/react/src/components/Icon';
    import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';import '../../packages/react/src/components/result.css';
    window.message=message;window.notification=notification;window.Modal=Modal;
    createRoot(document.getElementById('root')).render(<main style={{padding:24}}>
      {['info','success','warning','error'].map(s=><section data-testid={s} key={s}><Alert status={s} message={s+' 提示面板'} showIcon closable/><Result status={s} title={s+' 结果'}/></section>)}
      <Alert data-testid="hidden" message="无图标面板"/><Alert data-testid="banner" banner message="横幅"/>
      <Result data-testid="custom-result" icon={<Icon name="star"/>} title="自定义"/>
      <Result data-testid="hidden-result" icon={null} title="隐藏图标"/>
      <Popconfirm title="确认操作"><button>气泡默认</button></Popconfirm>
      <Popconfirm title="自定义确认" icon={<Icon name="star"/>}><button>气泡自定义</button></Popconfirm>
    </main>);
  `, resolveDir: path.join(root, 'apps/docs'), loader: 'tsx' }, bundle: true, write: false, outdir: 'out', format: 'iife', jsx: 'automatic' });
  const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text, css = bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<meta charset="utf-8"><style>' + css + '</style><div id="root"></div><script>' + js + '</script>'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = []; const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } }); const errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByTestId('info').waitFor();
    for (const state of ['info','success','warning','error']) {
      check(state+' 面板与结果为实心', await page.getByTestId(state).locator('.sia-alert__icon .sia-icon[data-variant="filled"],.sia-result__icon .sia-icon[data-variant="filled"]').count() === 2);
      await page.evaluate(s => { window.message.open({type:s,content:s+' 消息',duration:0,closable:true});window.notification.open({type:s,message:s+' 通知',duration:0}); }, state);
      await page.locator('.sia-message__icon .sia-icon[data-variant="filled"]').first().waitFor();
      check(state+' 消息与通知为实心', await page.locator('.sia-message__icon .sia-icon[data-variant="filled"]').count() === 1 && await page.locator('.sia-notification__icon .sia-icon[data-variant="filled"]').count() === 1);
      check(state+' 关闭仍为描边', await page.locator('.sia-message__close .sia-icon[data-variant="outline"]').count() === 1);
      await page.evaluate(() => { window.message.destroy();window.notification.destroy(); });
    }
    for (const type of ['default','info','success','warning','error','confirm']) {
      await page.evaluate(t => {window.handle=window.Modal.open({type:t,title:'提示类型 '+t,children:'保持原确认和关闭行为'});},type);
      await page.getByRole('dialog').waitFor();
      check(type+' 弹框状态图标', await page.locator('.sia-modal__type-icon .sia-icon[data-variant="filled"]').count() === (type === 'default' ? 0 : 1));
      await page.getByRole('button',{name:'关闭对话框',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'detached'});
    }
    await page.evaluate(() => {window.loading=window.message.loading('处理中',0);});
    await page.locator('.sia-message__icon svg').waitFor();
    check('加载仍为旋转描边', await page.locator('.sia-message__icon .sia-icon[data-variant="outline"]').count() === 1);
    await page.evaluate(() => window.loading.update({type:'success',content:'完成'}));
    await page.locator('.sia-message__icon .sia-icon[data-variant="filled"]').waitFor();check('加载更新成功切换实心',true);
    await page.evaluate(() => window.message.destroy());
    check('普通面板不新增图标',await page.getByTestId('hidden').locator('svg').count()===0);
    check('横幅使用实心',await page.getByTestId('banner').locator('.sia-icon[data-variant="filled"]').count()===1);
    check('结果自定义图标保留',await page.getByTestId('custom-result').locator('.sia-icon[data-variant="outline"]').count()===1);
    check('结果隐藏图标保留',await page.getByTestId('hidden-result').locator('svg').count()===0);
    for(const [name,variant] of [['气泡默认','filled'],['气泡自定义','outline']]){
      await page.getByRole('button',{name,exact:true}).click();await page.locator('.sia-popconfirm').waitFor();
      check(name,await page.locator('.sia-popconfirm .sia-icon[data-variant="'+variant+'"]').count()===1);
      await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('.sia-popconfirm').waitFor({state:'detached'});
    }
    await page.evaluate(()=>{window.notification.open({message:'自定义通知',icon:'自定义图标',duration:0});});
    await page.getByText('自定义图标',{exact:true}).waitFor();check('通知自定义节点保留',true);
    await page.evaluate(()=>window.notification.destroy());
    await page.setViewportSize({width:700,height:900});await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
    check('暗色窄屏无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check('没有运行时错误',errors.length===0);
    fs.mkdirSync(path.join(root,'logs/feedback-filled'),{recursive:true});
    await page.screenshot({path:path.join(root,'logs/feedback-filled/dark.png'),fullPage:true});
    await page.evaluate(()=>{delete document.documentElement.dataset.theme;});await page.setViewportSize({width:1100,height:1000});
    await page.screenshot({path:path.join(root,'logs/feedback-filled/light.png'),fullPage:true});
    fs.writeFileSync(path.join(root,'logs/feedback-filled/checks.json'),JSON.stringify({checks,errors},null,2));console.log(checks.length+' 项提示图标浏览器检查通过');
  } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
