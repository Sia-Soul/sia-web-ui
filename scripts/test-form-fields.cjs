// 通过真实控件验证外部错误回填、动态字段和清除；不依赖内部 Store 实现。
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const result=await build({stdin:{contents:`
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{Form}from '../../packages/react/src/components/Form';import{Input}from '../../packages/react/src/components/Input';
 import{Alert}from '../../packages/react/src/components/Alert';import{Button}from '../../packages/react/src/components/Button';
 import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
 function App(){const[form]=Form.useForm(),[visible,setVisible]=useState(false);window.form=form;window.mountField=()=>setVisible(true);window.changes=window.changes||0;
 if(!window.seeded){window.seeded=true;form.setFields([{name:['row','code'],value:'001',errors:['编号重复']},{name:'later',value:0,errors:['待处理']}]);}
 return <><Alert message="导入说明" description={<div>编号<strong data-testid="inline">必填</strong><Button variant="link">下载模板</Button></div>}/><Form form={form} initialValues={{row:{code:'原值',other:'保留'}}} onValuesChange={()=>window.changes++}>
 <Form.Item name={['row','code']} label="编号" rules={[{required:true,message:'请输入编号'}]}><Input aria-label="编号"/></Form.Item>
 {visible&&<Form.Item name="later" label="动态字段"><Input aria-label="动态字段"/></Form.Item>}
 </Form></>};createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('input[aria-label=编号]').waitFor();
 assert.equal(await page.locator('input[aria-label=编号]').inputValue(),'001');checks++;
 assert.deepEqual(await page.evaluate(()=>form.getFieldsValue()),{row:{code:'001',other:'保留'},later:0});checks++;
 assert.deepEqual(await page.evaluate(()=>form.getFieldError(['row','code'])),['编号重复']);checks++;
 await page.evaluate(()=>form.setFields([{name:['row','code'],errors:['格式错误','重复']}])) ;assert.equal(await page.locator('input[aria-label=编号]').inputValue(),'001');checks++;
 await page.evaluate(()=>form.setFields([{name:['row','code'],value:'002'}]));assert.deepEqual(await page.evaluate(()=>form.getFieldError(['row','code'])),['格式错误','重复']);checks++;
 await page.evaluate(()=>form.setFields([{name:['row','code'],errors:[]}]));assert.deepEqual(await page.evaluate(()=>form.getFieldError(['row','code'])),[]);checks++;
 assert.equal(await page.evaluate(()=>window.changes),0);checks++;
 await page.evaluate(()=>window.mountField());await page.locator('input[aria-label=动态字段]').waitFor();assert.deepEqual(await page.evaluate(()=>form.getFieldError('later')),['待处理']);checks++;
 await page.locator('input[aria-label=编号]').fill('手工修改');assert.deepEqual(await page.evaluate(()=>form.getFieldError(['row','code'])),[]);assert.ok(await page.evaluate(()=>window.changes)>0);checks++;
 await page.evaluate(()=>form.setFields([{name:['row','code'],value:undefined}]));assert.equal(await page.locator('input[aria-label=编号]').inputValue(),'');checks++;
 const validation=await page.evaluate(async()=>{try{await form.validateFields();return null}catch(e){return e.errorFields}});assert.equal(validation[0].errors[0],'请输入编号');checks++;
 await page.evaluate(()=>form.resetFields());assert.deepEqual(await page.evaluate(()=>form.getFieldError('later')),[]);assert.equal(await page.locator('input[aria-label=编号]').inputValue(),'原值');checks++;
 assert.equal(await page.getByTestId('inline').evaluate(n=>getComputedStyle(n).display),'inline');checks++;
 assert.ok(await page.getByRole('button',{name:'下载模板'}).evaluate(n=>getComputedStyle(n).color===getComputedStyle(n.querySelector('span')).color));checks++;
 assert.deepEqual(errors,[]);console.log(checks+' 组 Form.setFields / Alert 真实浏览器回归通过。');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
