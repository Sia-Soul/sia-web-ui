// 实际浏览器区分字段校验与保存异常，验证失败后的草稿、重试及弹框状态。
const assert = require('node:assert/strict'), path = require('node:path'), http = require('node:http'), fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const { build } = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite', { paths: [path.join(root, 'apps/docs')] }))] }));
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
 const bundle = await build({stdin:{contents:`
 import React from 'react';import{createRoot}from'react-dom/client';
 import{Form}from'../../packages/react/src/components/Form';import{Input}from'../../packages/react/src/components/Input';
 import{Button}from'../../packages/react/src/components/Button';import{Modal}from'../../packages/react/src/components/Modal';
 import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
 window.records={finish:0,invalid:0};window.mode='pending';
 function App(){const[form]=Form.useForm();const[busy,setBusy]=React.useState(false);const[open,setOpen]=React.useState(true);
 const finish=()=>{window.records.finish++;if(window.mode==='throw')throw Error('同步提交失败');
 setBusy(true);return new Promise((resolve,reject)=>{window.resolveSubmit=resolve;window.rejectSubmit=reject;}).then(()=>setOpen(false)).finally(()=>setBusy(false));};
 return <Modal open={open} title="异步表单" confirmLoading={busy} onOk={()=>{form.submit();return false;}} onCancel={()=>setOpen(false)}>
 <Form form={form} onFinish={finish} onFinishFailed={()=>{window.records.invalid++;}}><Form.Item name="name" label="名称" rules={[{required:true,message:'请输入名称'}]}><Input placeholder="名称"/></Form.Item></Form></Modal>;
 }createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[],errors=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
 try{const p=await browser.newPage({viewport:{width:900,height:700}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);
 const ok=p.getByRole('button',{name:'确定',exact:true});await ok.click();await p.waitForTimeout(150);
 check('空字段只触发校验失败',await p.evaluate(()=>records.invalid===1&&records.finish===0));
 await p.getByPlaceholder('名称',{exact:true}).fill('保留的草稿');
 for(const kind of ['error','string','undefined']){
  await ok.click();await p.waitForFunction(()=>typeof window.rejectSubmit==='function');
  check(kind+' 等待时显示loading',await ok.isDisabled()&&await ok.getAttribute('aria-busy')==='true');
  await p.keyboard.press('Escape');check(kind+' 等待时保持弹框',await p.getByRole('dialog').isVisible());
  await p.evaluate(k=>{window.rejectSubmit(k==='error'?new Error('受控保存失败'):k==='string'?'受控失败':undefined);delete window.rejectSubmit;},kind);await p.waitForTimeout(150);
  check(kind+' 失败保留草稿和按钮恢复',await p.getByPlaceholder('名称',{exact:true}).inputValue()==='保留的草稿'&&await ok.isEnabled());
 }
 await p.evaluate(()=>{window.mode='throw';});await ok.click();await p.waitForTimeout(150);
 check('同步抛错保留弹框',await p.getByRole('dialog').isVisible());check('保存异常不触发字段校验失败',await p.evaluate(()=>records.invalid===1));
 await p.evaluate(()=>{window.mode='pending';});await ok.click();await p.waitForFunction(()=>typeof window.rejectSubmit==='function');await p.screenshot({path:path.join(root,'logs/form-submit-pending.png')});
 await p.evaluate(()=>window.resolveSubmit());await p.getByRole('dialog').waitFor({state:'detached'});check('重试成功正常关闭',true);check('没有未处理异常',errors.length===0);
 fs.writeFileSync(path.join(root,'logs/form-submit-errors.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
