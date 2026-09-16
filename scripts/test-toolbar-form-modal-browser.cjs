const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
 const page = await browser.newPage();
 await page.goto('http://127.0.0.1:4173/components/select');
 await page.evaluate(async (sourcePath) => {
  const React = await import('/node_modules/.vite/deps/react.js');
  const client = await import('/node_modules/.vite/deps/react-dom_client.js'); const createRoot = client.createRoot ?? client.default.createRoot;
  const rootPath='/@fs/'+sourcePath+'/packages/react/src/components/';
  const {Toolbar}=await import(rootPath+'Toolbar.tsx');
  const {Form}=await import(rootPath+'Form.tsx');
  const {Select}=await import(rootPath+'Select.tsx');
  const {Modal}=await import(rootPath+'Modal.tsx');
  const h=React.createElement ?? React.default.createElement;
  const host=document.createElement('div'); document.body.replaceChildren(host);
  window.actions=[];
  window.modal=Modal;
  createRoot(host).render(h('div',null,
   h('div',{id:'toolbar-host',style:{width:210}},h(Toolbar,{items:[{key:'a',label:'添加数据'},{key:'b',label:'批量启用',split:true,children:[{key:'disable',label:'批量禁用'}]},{key:'c',label:'修改标签'},{key:'d',label:'无权限操作',disabled:true}],onAction:k=>window.actions.push(k)})),
   h(Form,{initialValues:{owner:null}},h(Form.Item,{name:'owner'},h(Select,{placeholder:'测试负责人',popupMode:'modal',allowClear:true,options:[{value:0,label:'零号用户'},{value:1,label:'山猫'}]})))
  ));
 }, require('node:path').resolve(__dirname, '..').replaceAll('\\', '/'));
 await page.getByRole('button',{name:'更多操作',exact:true}).hover();
 await page.waitForTimeout(600); await page.getByText('修改标签',{exact:true}).last().click();
 assert.deepEqual(await page.evaluate(()=>window.actions),['c']);
 await page.evaluate(()=>document.querySelector('#toolbar-host').style.width='1200px');
 await page.getByRole('button',{name:'更多操作',exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'修改标签',exact:true}).isVisible(),true);
 await page.getByRole('combobox').click();
 let dialog=page.getByRole('dialog');
 assert.equal(await dialog.getByText('已选项(0)',{exact:true}).count(),1);
 await dialog.getByRole('option',{name:'零号用户',exact:true}).click();
 await dialog.getByRole('button',{name:'确定',exact:true}).click();
 await page.getByRole('combobox').click();
 await dialog.getByText('已选项(1)',{exact:true}).click();
 await dialog.getByRole('option',{name:'零号用户',exact:true}).click();
 await dialog.getByRole('button',{name:'确定',exact:true}).click();
 await page.getByRole('combobox').click();
 assert.equal(await dialog.getByText('已选项(0)',{exact:true}).count(),1);
 await dialog.getByRole('button',{name:'取消',exact:true}).click();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.modal.open({title:'固定高度',height:500,children:'测试内容'}));
 const box=await dialog.boundingBox(); assert.ok(Math.abs(box.height-500)<2);
 console.log('PASS: toolbar overflow/resize/actions; Form Select empty, numeric zero and clear; Modal height');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});