// 真实浏览器验证 Escape 只收起当前选择器；再次按键才关闭外层，嵌套弹框保留原关闭层级。
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const result=await build({stdin:{contents:`
 import React,{useState} from 'react';import{createRoot}from'react-dom/client';
 import{Select}from '../../packages/react/src/components/Select';
 import{Drawer}from '../../packages/react/src/components/Drawer';
 import{Modal}from '../../packages/react/src/components/Modal';
 import '../../packages/react/src/styles.css';
 function App(){const[open,setOpen]=useState(false),[kind,setKind]=useState('drawer');const props={open,onCancel:()=>setOpen(false),onOpenChange:setOpen,title:'外层编辑'};const content=<><Select placeholder="普通选择" popupMode="dropdown" options={[{value:'a',label:'甲'}]}/><Select placeholder="搜索选择" showSearch popupMode="dropdown" options={[{value:'a',label:'甲'}]}/><Select placeholder="多选选择" mode="multiple" popupMode="dropdown" options={[{value:'a',label:'甲'}]}/><Select placeholder="弹框选择" popupMode="modal" options={[{value:'a',label:'甲'}]}/></>;return <><button onClick={()=>{setKind('drawer');setOpen(true)}}>打开抽屉</button><button onClick={()=>{setKind('modal');setOpen(true)}}>打开弹框</button>{kind==='drawer'?<Drawer {...props}>{content}</Drawer>:<Modal {...props}>{content}</Modal>}</>};createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:path.join(root,'apps/docs'),loader:'tsx'},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
 try{const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);
 for(const kind of ['抽屉','弹框'])for(const name of ['普通选择','搜索选择','多选选择','弹框选择']){
 await p.getByRole('button',{name:'打开'+kind,exact:true}).click();const outer=p.getByRole('dialog',{name:'外层编辑',exact:true});await outer.waitFor();const combo=outer.getByRole('combobox').nth(['普通选择','搜索选择','多选选择','弹框选择'].indexOf(name));await combo.click();await p.waitForTimeout(250);
 if(name==='多选选择')await p.getByRole('button',{name:'全选',exact:true}).focus();
 await p.keyboard.press('Escape');await p.waitForTimeout(350);assert.equal(await outer.isVisible(),true,kind+' / '+name+' 不应关闭外层');assert.equal(await combo.getAttribute('aria-expanded'),'false');
 await combo.focus();await p.keyboard.press('Escape');await outer.waitFor({state:'hidden'});console.log(kind+' / '+name+' 两级关闭通过');
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
