// 浏览器选择和拖入混合类型文件；业务接管类型校验时完整批次不能丢失，默认安全约束保持不变。
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const result=await build({stdin:{contents:`
 import React from'react';import{createRoot}from'react-dom/client';import{Upload}from '../../packages/react/src/components/Upload';
 import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
 window.events=[];const record=(id,file,files)=>{window.events.push({id,file:file.name,files:files.map(f=>f.name)});return Upload.LIST_IGNORE};
 function App(){return <main>{['default','hint','limit','disabled'].map(id=><section key={id} data-testid={id}><Upload.Dragger multiple accept=".png" acceptMode={id==='default'?undefined:'hint'} maxCount={id==='limit'?1:undefined} disabled={id==='disabled'} beforeUpload={(f,fs)=>record(id,f,fs)} onReject={({file,reason})=>window.events.push({id,reject:file.name,reason})}/></section>)}</main>};createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);const payload=[{name:'bad.gif',mimeType:'image/gif',buffer:Buffer.from('gif')},{name:'good.png',mimeType:'image/png',buffer:Buffer.from('png')}];
 const events=id=>page.evaluate(id=>window.events.filter(e=>e.id===id),id);
 await page.getByTestId('default').locator('input').setInputFiles(payload);await page.waitForTimeout(100);assert.deepEqual(await events('default'),[{id:'default',reject:'bad.gif',reason:'accept'},{id:'default',file:'good.png',files:['good.png']}]);checks++;
 await page.getByTestId('hint').locator('input').setInputFiles(payload);await page.waitForTimeout(100);let e=await events('hint');assert.equal(e.length,2);assert.deepEqual(e[0].files,['bad.gif','good.png']);assert.equal(await page.getByTestId('hint').locator('input').getAttribute('accept'),'.png');checks++;
 await page.getByTestId('limit').locator('input').setInputFiles(payload);await page.waitForTimeout(100);e=await events('limit');assert.ok(e.some(x=>x.reason==='max-count'));assert.equal(e.filter(x=>x.file).length,1);checks++;
 for(const id of ['default','hint','disabled']){await page.evaluate(()=>{window.events=[]});const transfer=await page.evaluateHandle(()=>{const t=new DataTransfer();t.items.add(new File(['gif'],'drop.gif',{type:'image/gif'}));return t;});await page.getByTestId(id).locator('.sia-upload').dispatchEvent('drop',{dataTransfer:transfer});await page.waitForTimeout(100);e=await events(id);if(id==='default')assert.equal(e[0].reason,'accept');if(id==='hint')assert.equal(e[0].file,'drop.gif');if(id==='disabled')assert.equal(e.length,0);checks++;}
 assert.deepEqual(errors,[]);console.log(checks+' 组 Upload 类型校验浏览器回归通过。');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
