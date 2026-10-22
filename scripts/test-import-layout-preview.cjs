// 真实浏览器验证填充表单与分组预览，覆盖窗口缩放、键盘、动态图片及独立预览。
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const result=await build({stdin:{contents:`
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{Form}from '../../packages/react/src/components/Form';import{Image,ImagePreviewGroup}from '../../packages/react/src/components/DataDisplay';
 import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
 const pic=color=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="'+color+'"/></svg>');
 function App(){const[shown,setShown]=useState(true),[reverse,setReverse]=useState(false);window.remove=()=>setShown(false);window.reverse=()=>setReverse(v=>!v);
 return <div style={{height:'80vh',display:'flex',flexDirection:'column'}}><header>固定标题</header><Form fill><div data-testid="list" style={{flex:1,minHeight:0,overflow:'auto'}}>剩余列表</div><footer>固定页脚</footer></Form><ImagePreviewGroup><div>{(reverse?['b','a']:['a','b']).filter(id=>shown||id!=='b').map(id=><Image key={id} src={pic(id==='a'?'red':'blue')} alt={id} width={80}/>)}</div><Image src={pic('gray')} alt="excluded" preview={false} width={80}/></ImagePreviewGroup><Image src={pic('green')} alt="independent" width={80}/></div>};createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
 try{const page=await browser.newPage({viewport:{width:1000,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const h=async()=>page.getByTestId('list').evaluate(n=>n.getBoundingClientRect().height);await page.getByTestId('list').waitFor();assert.ok(await h()>300);checks++;
 const before=await h();await page.setViewportSize({width:700,height:600});assert.ok(await h()<before);assert.ok(await h()>50);checks++;
 const open=alt=>page.getByAltText(alt,{exact:true}).locator('..').getByRole('button').click();await open('a');const dialog=page.getByRole('dialog',{name:'图片预览'});await dialog.waitFor();assert.equal(await dialog.getByLabel('图片序号').innerText(),'1 / 2');checks++;
 assert.ok(await dialog.getByRole('button',{name:'上一张',exact:true}).isDisabled());checks++;
 await dialog.getByRole('button',{name:'下一张',exact:true}).click();await dialog.getByAltText('b',{exact:true}).waitFor();assert.ok(await dialog.getByRole('button',{name:'下一张',exact:true}).isDisabled());checks++;
 await page.keyboard.press('ArrowLeft');await dialog.getByAltText('a',{exact:true}).waitFor();checks++;
 await page.keyboard.press('ArrowRight');await dialog.getByAltText('b',{exact:true}).waitFor();checks++;
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});checks++;
 await page.evaluate(()=>window.reverse());await open('b');assert.equal(await dialog.getByLabel('图片序号').innerText(),'1 / 2');checks++;
 await page.evaluate(()=>window.remove());await dialog.waitFor({state:'hidden'});checks++;
 await open('a');assert.equal(await dialog.getByLabel('图片序号').count(),0);await page.keyboard.press('Escape');checks++;
 await open('independent');assert.equal(await dialog.getByLabel('图片序号').count(),0);await dialog.getByAltText('independent',{exact:true}).waitFor();checks++;
 assert.deepEqual(errors,[]);console.log(checks+' 组 Form.fill / ImagePreviewGroup 浏览器回归通过。');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
