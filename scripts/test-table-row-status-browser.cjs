// 实际框架组件回归：状态行覆盖斑马纹、固定列一致、状态更新及 DOM/Canvas 共用背景。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright-core'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:700}});
  await page.goto('http://127.0.0.1:4173/components/table');
  await page.evaluate(async()=>{
   const {default:React}=await import('/node_modules/.vite/deps/react.js');
   const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
   const {Table}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/Table.tsx');
   const host=document.createElement('div');document.body.replaceChildren(host);const root=createRoot(host);
   window.mountStatus=(mode,status)=>root.render(React.createElement(Table,{rowKey:'id',height:300,striped:true,showIndex:false,renderMode:mode,rowStatus:status?()=>status:undefined,columns:[{key:'name',code:'name',name:'名称',fixed:'left',width:180},{key:'description',code:'description',name:'内容',width:1000}],dataSource:[{id:1,name:'待复核',description:'状态变更回归'},{id:2,name:'第二行',description:'斑马纹回归'}]}));
  });
  for(const mode of ['dom','canvas']){
   const colors={};
   for(const status of ['warning','success','error',undefined]){
    await page.evaluate(args=>window.mountStatus(...args),[mode,status]);
    await page.waitForFunction(status=>{const row=document.querySelector('.sia-table__row');return row && (status?row.classList.contains('sia-table__row--'+status):!['warning','success','error'].some(s=>row.classList.contains('sia-table__row--'+s)));},status);
    const values=await page.locator('.sia-table__row').first().locator('.sia-table__cell').evaluateAll(cells=>cells.map(c=>getComputedStyle(c).backgroundColor));
    assert.equal(values.length,2);assert.equal(values[0],values[1]);colors[status||'default']=values[0];
   }
   assert.equal(new Set(Object.values(colors)).size,4);
  }
  console.log('PASS 表格语义状态行：DOM/Canvas、警告/成功/错误/清空、固定列与普通列背景一致、同一数据更新状态。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
