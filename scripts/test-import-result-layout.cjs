// 真实浏览器验证自然高度结果表及横向步骤标题，避免用固定弹框高度掩盖内容尺寸。
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const result=await build({stdin:{contents:`
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{Steps}from '../../packages/react/src/components/Navigation';
 import{Table}from '../../packages/react/src/components/table/Table';
 import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
 function App(){const[count,setCount]=useState(2),[mode,setMode]=useState('dom'),[cap,setCap]=useState(180),[height,setHeight]=useState(undefined),[status,setStatus]=useState('info');window.configure=(n,m='dom',c=180,h=undefined,s='info')=>{setCount(n);setMode(m);setCap(c);setHeight(h);setStatus(s)};
 return <main style={{padding:16}}><Steps data-testid="inline" labelPlacement="horizontal" items={[{title:'导入资料'},{title:'完善工作表'},{title:'提交结果'}]}/><Steps data-testid="below" items={[{title:'第一步'},{title:'第二步'}]}/><Steps data-testid="small" size="small" labelPlacement="horizontal" items={[{title:'资料'},{title:'结果'}]}/><Steps data-testid="vertical" direction="vertical" labelPlacement="horizontal" items={[{title:'第一步'},{title:'第二步'}]}/><section data-testid="table"><Table rowKey="id" maxBodyHeight={cap} height={height} renderMode={mode} rowStatus={status} columns={[{key:'id',dataIndex:'id',title:'编号',fixed:'left',width:100},{key:'name',dataIndex:'name',title:'名称',width:400}]} dataSource={Array.from({length:count},(_,id)=>({id,name:'记录 '+id}))}/></section></main>};createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
 try{const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByTestId('table').waitFor();
 const box=async(id,selector)=>page.getByTestId(id).locator(selector).first().boundingBox();
 for(const id of ['inline','small']){const i=await box(id,'.sia-steps__icon'),t=await box(id,'.sia-steps__title');assert.ok(t.x>i.x+i.width);assert.ok(Math.abs(t.y+t.height/2-i.y-i.height/2)<2);checks++;}
 {const i=await box('below','.sia-steps__icon'),t=await box('below','.sia-steps__title');assert.ok(t.y>=i.y+i.height);checks++;}
 for(const width of [700,640]){await page.setViewportSize({width,height:1000});const steps=page.getByTestId('inline');assert.equal(await steps.evaluate(n=>getComputedStyle(n).flexDirection),'column');assert.equal(await steps.locator('.sia-steps__inline-tail').first().evaluate(n=>getComputedStyle(n).display),'none');checks++;}
 await page.setViewportSize({width:1100,height:1000});
 const metrics=()=>page.getByTestId('table').evaluate(n=>{const r=n.querySelector('.sia-table'),v=n.querySelector('.sia-table__viewport');return{root:r.getBoundingClientRect().height,view:v.clientHeight,scroll:v.scrollHeight};});
 for(const mode of ['dom','canvas']){
  for(const count of [0,2,120]){await page.evaluate(([n,m])=>window.configure(n,m),[count,mode]);await page.waitForTimeout(200);const m=await metrics();console.log({mode,count,...m});assert.ok(m.view<=218);if(count===2)assert.ok(m.view<150);if(count===120){assert.ok(m.view>=210&&m.scroll>1000);await page.locator('.sia-table__viewport').evaluate(n=>{n.scrollTop=n.scrollHeight});await page.getByRole('cell',{name:'记录 119',exact:true}).waitFor();}checks++;}
  await page.evaluate(m=>window.configure(2,m),mode);await page.waitForTimeout(100);const backgrounds=await page.locator('.sia-table__row').first().locator('td').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));assert.equal(new Set(backgrounds).size,1);assert.ok(!backgrounds[0].includes('255, 255, 255'));checks++;
 }
 await page.evaluate(()=>window.configure(50,'dom','120px',100));await page.waitForTimeout(100);assert.ok((await metrics()).root<=102);checks++;
 await page.evaluate(()=>window.configure(50,'dom','120px'));await page.waitForTimeout(100);assert.ok((await metrics()).view<=158);checks++;
 assert.deepEqual(errors,[]);console.log(checks+' 组 Steps / Table 结果布局浏览器回归通过。');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
