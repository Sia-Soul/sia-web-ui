// 在实际 Edge 中验证纯文字、多行内容、输入及错误提示的居中，同时保护默认和窄屏布局。
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const result=await build({stdin:{contents:`
 import React from 'react';import{createRoot}from'react-dom/client';
 import{Form}from '../../packages/react/src/components/Form';
 import{Input}from '../../packages/react/src/components/Input';
 import '../../packages/react/src/styles.css';
 import '../../packages/react/src/components-extra.css';
 function App(){return <>{['small','medium','large'].map(size=><Form key={size} size={size}>
 <Form.Item label="纯文字" align="center"><span>是</span></Form.Item>
 <Form.Item label="多行内容" align="center"><div>商品 店铺 订单<br/>采购入库 售后单<br/>库存盘点</div></Form.Item>
 <Form.Item label="输入" align="center"><Input/></Form.Item>
 <Form.Item label="错误" align="center" validateStatus="error" help="必填"><Input/></Form.Item>
 <Form.Item label="默认"><Input/></Form.Item></Form>)}<Form layout="vertical"><Form.Item label="纵向" align="center"><Input/></Form.Item></Form></>};createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage({viewport:{width:1000,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(300);
 const rows=await page.locator('.sia-form--horizontal .sia-form-item--align-center').evaluateAll(nodes=>nodes.map(node=>{const label=node.querySelector('.sia-form-item__label').getBoundingClientRect();const content=node.querySelector('.sia-form-item__input-wrap').getBoundingClientRect();return {delta:Math.abs(label.y+label.height/2-content.y-content.height/2),height:content.height};}));
 assert.equal(rows.length,12);assert.ok(rows.every(row=>row.delta<1),JSON.stringify(rows));
 assert.deepEqual(rows.filter((_,i)=>i%4===0).map(x=>x.height),[22,30,38]);
 await page.screenshot({path:path.join(root,'logs-form-align-wide.png')});
 await page.setViewportSize({width:375,height:1100});await page.waitForTimeout(100);
 assert.ok(await page.locator('.sia-form-item').evaluateAll(nodes=>nodes.every(node=>{const label=node.querySelector('.sia-form-item__label').getBoundingClientRect(),control=node.querySelector('.sia-form-item__control').getBoundingClientRect();return control.y>=label.bottom;})));
 await page.screenshot({path:path.join(root,'logs-form-align-narrow.png')});assert.deepEqual(errors,[]);console.log('12 组居中、三种行高、窄屏堆叠和错误气泡通过。');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
