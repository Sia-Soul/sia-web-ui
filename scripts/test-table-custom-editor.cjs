// 组合编辑器回归：真实鼠标验证边界、横竖布局、弹层交互和切格结束编辑。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const {build}=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite',{paths:[path.join(root,'apps/docs')]}))]}));
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.join(root,'logs/table-custom-editor');fs.mkdirSync(out,{recursive:true});
(async()=>{
const bundle=await build({stdin:{resolveDir:path.join(root,'apps/docs'),loader:'tsx',contents:`
import React,{useMemo,useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Table} from '../../packages/react/src/components/Table/Table';
import {createWorksheetPlugin} from '../../packages/react/src/components/Table/worksheet';
import {Space,Flex} from '../../packages/react/src/components/Layout';import {Select} from '../../packages/react/src/components/Select';
import {Tooltip} from '../../packages/react/src/components/FloatingDisplay';
import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
function App(){const [rows,setRows]=useState(Array.from({length:500},(_,i)=>({id:i,props:i===0?['1','11','a']:['2','22','b'],name:'第'+(i+1)+'行'}))),[vertical,setVertical]=useState(false),[height,setHeight]=useState(80);const ref=useRef(null);window.setHeight=setHeight;
const plugin=useMemo(()=>createWorksheetPlugin({onChange:setRows}),[]);window.rows=rows;window.table=()=>ref.current;
const fields=['材质','风格','安装方式'];const opts=[['1','2','3'],['11','22','33'],['a','b','c']];
const control=(r,i)=><Select size="small" aria-label={fields[i]} mode={i===2?'multiple':undefined} value={r.props[i]} options={opts[i].map(v=>({label:v,value:v}))} onChange={v=>{const next=[...r.props];next[i]=v;ref.current.getPluginApi('worksheet').editCell({rowKey:r.id,columnKey:'props'},next);}}/>;
const editor=r=>${process.env.EDITOR_LEGACY!=='1'?'<Flex vertical={vertical} gap={vertical?2:"small"} align="stretch">{fields.map((f,i)=><Flex key={f} vertical={!vertical} flex={vertical?"0 0 auto":"1 1 0"} gap={4} align={vertical?"center":"stretch"}><Flex flex={vertical?"0 0 80px":undefined}>{f}</Flex><Flex flex={vertical?"1 1 0":undefined}>{control(r,i)}</Flex></Flex>)}</Flex>':'<Space direction={vertical?"vertical":"horizontal"}>{fields.map((f,i)=><div key={f}><span>{f}</span>{control(r,i)}</div>)}</Space>'};
return <><button onClick={()=>setVertical(v=>!v)}>切换排列</button><button>外部按钮</button><Table ref={ref} dataSource={rows} rowKey="id" columns={[{key:'fixed',title:'固定编号',fixed:'left',width:160,render:()=> '固定编号'},{key:'props',title:'类目属性',dataIndex:'props',width:480,editable:{type:'custom',editRender:editor},render:v=>v.flat().join(' / ')},{key:'name',title:'名称',dataIndex:'name',width:260,editable:true},{key:'readOnly',title:'只读',width:150,render:()=> '只读'}]} height={360} rowHeights={{0:height,1:80}} striped={false} plugins={[plugin]}/></>}
createRoot(document.getElementById('root')).render(<><App/><Tooltip title=""><button>空提示</button></Tooltip><Tooltip title="正常提示"><button>有提示</button></Tooltip></>);`},bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic'});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const server=http.createServer((q,s)=>{s.setHeader('Content-Type','text/html; charset=utf-8');s.end(`<meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${js}</script>`)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1000,height:600}});const failures=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{try{await fn();console.log('PASS '+name)}catch(e){failures.push(name+': '+e.message);console.log('FAIL '+name+': '+e.message)}};
try{await page.goto('http://127.0.0.1:'+server.address().port);const cell=(id,key='props')=>page.locator('tr[data-row-key="'+id+'"] td[data-column-key="'+key+'"]');await cell(0).dblclick();
await check('横排三个控件完整位于单元格内',async()=>{const rect=await cell(0).boundingBox();for(const box of await cell(0).getByRole('combobox').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right}})))assert.ok(box.x>=rect.x&&box.right<=rect.x+rect.width+1,JSON.stringify(box));});
await page.screenshot({path:path.join(out,'horizontal.png')});
await cell(1).click();await check('点击其他单元格结束原自定义编辑',async()=>assert.equal(await page.locator('.sia-table__editor').count(),0));
await page.getByText('切换排列',{exact:true}).click();await cell(0).dblclick();
await check('默认行高竖排三个字段全部可见',async()=>{const rect=await cell(0).boundingBox();for(const box of await cell(0).getByRole('combobox').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right}})))assert.ok(box.top>=rect.y&&box.bottom<=rect.y+rect.height+1&&box.right<=rect.x+rect.width+1,JSON.stringify(box))});
await page.screenshot({path:path.join(out,'vertical.png')});
await page.evaluate(()=>window.setHeight(56));
await check('缩小行高时仅在编辑器内滚动',async()=>{const metrics=await page.locator('.sia-table__editor').evaluate(e=>({overflow:getComputedStyle(e).overflowY,client:e.clientHeight,scroll:e.scrollHeight}));assert.ok(['auto','scroll'].includes(metrics.overflow));assert.ok(metrics.scroll>metrics.client)});
await page.evaluate(()=>window.setHeight(80));
await cell(0).getByRole('combobox',{name:'材质',exact:true}).click();await page.getByRole('option',{name:'2',exact:true}).click();
await check('弹层选择不误关闭编辑并保留写回数据',async()=>{assert.equal(await page.locator('.sia-table__editor').count(),1);assert.equal(await page.evaluate(()=>window.rows[0].props[0]),'2')});
await cell(0).getByRole('combobox',{name:'安装方式',exact:true}).click();await page.getByRole('option',{name:'b',exact:true}).click();await page.getByRole('option',{name:'c',exact:true}).click();
await check('多选弹层可连续操作，不误退出编辑',async()=>{assert.equal(await page.locator('.sia-table__editor').count(),1);const values=await page.evaluate(()=>window.rows[0].props[2]);assert.ok(values.includes('b')&&values.includes('c'))});
await page.getByText('外部按钮',{exact:true}).click();await check('点击表格外结束自定义编辑',async()=>assert.equal(await page.locator('.sia-table__editor').count(),0));
await cell(0).dblclick();await cell(1,'readOnly').click();await check('点击只读格也结束编辑',async()=>assert.equal(await page.locator('.sia-table__editor').count(),0));
// 行高大于文本时，四周留白也属于单元格编辑入口。
await check('双击单元格左上留白进入编辑',async()=>{await cell(0,'name').dblclick({position:{x:5,y:5}});assert.equal(await cell(0,'name').locator('.sia-table__editor').count(),1)});
await page.getByText('外部按钮',{exact:true}).click();
await check('右上、左下和右侧留白均可编辑，只读格不进入编辑',async()=>{
  const box=await cell(0,'name').boundingBox();
  for(const position of [{x:box.width-5,y:5},{x:5,y:box.height-5},{x:box.width-5,y:box.height/2}]){
    await cell(0,'name').dblclick({position});assert.equal(await cell(0,'name').locator('.sia-table__editor').count(),1);await page.getByText('外部按钮',{exact:true}).click();
  }
  await cell(0,'readOnly').dblclick({position:{x:5,y:5}});assert.equal(await page.locator('.sia-table__editor').count(),0);
});
await check('空标题不出现黑色气泡',async()=>{await page.getByRole('button',{name:'空提示',exact:true}).hover();await page.waitForTimeout(250);assert.equal(await page.getByRole('tooltip').count(),0)});
await check('正常文字气泡仍能显示',async()=>{await page.getByRole('button',{name:'有提示',exact:true}).hover();await page.getByRole('tooltip').filter({hasText:'正常提示'}).waitFor()});
// 编辑器随正文滚动时，吸顶列头仍必须位于最上层并能接收鼠标。
await check('编辑状态滚动后不遮挡吸顶列头',async()=>{
 await page.getByText('外部按钮',{exact:true}).click();await cell(0,'name').dblclick();
 await page.locator('.sia-table__viewport').first().evaluate(e=>e.scrollTop=50);await page.waitForTimeout(100);
 const hit=await page.locator('th[data-column-key="name"]').evaluate(th=>{const r=th.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {header:th.contains(e),tag:e?.tagName,cls:e?.className}});
 await page.screenshot({path:path.join(out,'scroll-header-green.png')});assert.equal(hit.header,true,JSON.stringify(hit));
});
await check('横向滚动自定义编辑器不覆盖固定列',async()=>{
 await page.getByText('外部按钮',{exact:true}).click();await page.locator('.sia-table__viewport').first().evaluate(e=>{e.scrollTop=0;e.scrollLeft=0});await cell(0).dblclick();
 await page.locator('.sia-table__viewport').first().evaluate(e=>e.scrollLeft=100);await page.waitForTimeout(100);
 const hit=await cell(0,'fixed').evaluate(td=>{const r=td.getBoundingClientRect(),e=document.elementFromPoint(r.right-10,r.y+r.height/2);return td.contains(e)});assert.equal(hit,true);
 await page.screenshot({path:path.join(out,'scroll-fixed-green.png')});
});
await check('无页面异常',async()=>assert.deepEqual(errors,[]));
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({failures,errors},null,2));assert.deepEqual(failures,[]);
}catch(e){console.log('PAGE ERRORS',errors);await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
