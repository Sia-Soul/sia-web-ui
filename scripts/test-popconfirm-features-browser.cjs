const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
// 浏览器验证定位、箭头和异步状态，避免仅验证回调最终结果。
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.argv[3]});
 try {
  const page = await browser.newPage({viewport:{width:1200,height:900}});
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/components/popconfirm');
  await page.evaluate(async()=>{
   const {default:React}=await import('/node_modules/.vite/deps/react.js');
   const dom=await import('/node_modules/.vite/deps/react-dom_client.js');
   const {Popconfirm}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Feedback.tsx');
   const {Button}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Button.tsx');
   const host=document.createElement('div');document.body.replaceChildren(host);
   const root=(dom.default??dom).createRoot(host);let key=0;
   window.renderCase=(options={})=>{
    window.stats={calls:0,errors:0,changes:[]};
    const {mode='sync',scroll=false,...props}=options;
    root.render(React.createElement('div',{id:'scroll',style:{position:'absolute',left:scroll?80:450,top:scroll?160:350,width:scroll?400:500,height:scroll?260:200,overflow:scroll?'auto':'visible'}},
     React.createElement('div',{style:scroll?{width:1000,height:800,padding:100,boxSizing:'border-box'}:{}},
      React.createElement(Popconfirm,{key:++key,title:'确认操作？',description:'请核对内容',onOpenChange:value=>window.stats.changes.push(value),
       onConfirm:()=>{window.stats.calls++;if(mode==='throw')throw Error('failed');if(mode==='false')return false;if(mode==='reject')return Promise.reject(Error('failed'));if(mode==='defer')return new Promise((resolve,reject)=>{window.resolveConfirm=resolve;window.rejectConfirm=reject;});},
       onConfirmError:()=>window.stats.errors++,...props},React.createElement(Button,{style:{width:120,height:60}},'目标名称')))));
   };
  });
  const button=page.getByRole('button',{name:'目标名称',exact:true});
  const popup=page.locator('.sia-floating__overlay');
  async function render(options){await page.evaluate(options=>window.renderCase(options),options);await button.waitFor();await page.waitForTimeout(40);}
  const directions={top:'top',topLeft:'top-start',topRight:'top-end',bottom:'bottom',bottomLeft:'bottom-start',bottomRight:'bottom-end',left:'left',leftTop:'left-start',leftBottom:'left-end',right:'right',rightTop:'right-start',rightBottom:'right-end'};
  for(const [placement,canonical] of Object.entries(directions)){
   await render({placement,arrow:{pointAtCenter:true}});await button.click();await popup.waitFor();await page.waitForTimeout(160);
   assert.ok((await popup.getAttribute('class')).includes('overlay--'+canonical));
   const a=await button.boundingBox(),b=await popup.boundingBox(),arrow=await page.locator('.sia-floating__arrow').boundingBox();
   const vertical=canonical.startsWith('top')||canonical.startsWith('bottom');
   assert.ok(Math.abs(vertical?a.x+a.width/2-arrow.x-arrow.width/2:a.y+a.height/2-arrow.y-arrow.height/2)<2,'中心箭头 '+placement);
   if(canonical.startsWith('top'))assert.ok(b.y+b.height<a.y);
   if(canonical.startsWith('bottom'))assert.ok(b.y>a.y+a.height);
   if(canonical.startsWith('left'))assert.ok(b.x+b.width<a.x);
   if(canonical.startsWith('right'))assert.ok(b.x>a.x+a.width);
  }
  console.log('PASS 十二方向和中心箭头');
  await render({placement:'left-start',arrow:false});await button.click();assert.equal(await page.locator('.sia-floating__arrow').count(),0);
  await render({skipConfirm:true,mode:'defer'});await button.click();await button.click();assert.equal(await popup.count(),0);assert.equal(await page.evaluate(()=>window.stats.calls),1);await page.evaluate(()=>window.resolveConfirm());
  await render({skipConfirm:true,disabled:true});await button.click();assert.equal(await page.evaluate(()=>window.stats.calls),0);
  await render({mode:'false'});await button.click();await page.getByRole('button',{name:'确定',exact:true}).click();assert.equal(await popup.isVisible(),true);
  for(const mode of ['reject','throw']){await render({mode});await button.click();await page.getByRole('button',{name:'确定',exact:true}).click();await page.waitForTimeout(50);assert.equal(await popup.isVisible(),true);assert.equal(await page.evaluate(()=>window.stats.errors),1);}
  await render({mode:'defer'});await button.click();await page.getByRole('button',{name:'确定',exact:true}).click();assert.equal(await popup.locator('.sia-button__spinner').count(),1);
  await page.evaluate(()=>document.querySelector('.sia-popconfirm__actions .sia-button--primary').click());assert.equal(await page.evaluate(()=>window.stats.calls),1);
  await page.evaluate(()=>window.resolveConfirm());await popup.waitFor({state:'detached'});
  await render({mode:'defer'});await button.click();await page.getByRole('button',{name:'确定',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();await button.click();await page.evaluate(()=>window.resolveConfirm());await page.waitForTimeout(80);assert.equal(await popup.isVisible(),true,'旧请求不能关闭重开的气泡');
  await render({open:true});await page.getByRole('button',{name:'确定',exact:true}).click();await page.waitForTimeout(30);assert.equal(await popup.isVisible(),true);assert.ok((await page.evaluate(()=>window.stats.changes)).includes(false),'受控确认应请求外部关闭');
  console.log('PASS 条件跳过、禁用、同步保持、异步成功/失败、防重入、过期请求和受控关闭');
  await render({scroll:true});await button.click();await popup.waitFor();await page.waitForTimeout(160);
  await page.evaluate(()=>document.querySelector('#scroll').scrollLeft=350);await page.waitForTimeout(80);assert.equal(await popup.isVisible(),false,'目标完全滚出时隐藏');
  await page.evaluate(()=>document.querySelector('#scroll').scrollLeft=0);await page.waitForTimeout(80);assert.equal(await popup.isVisible(),true,'目标滚回时恢复');
  await render({placement:'leftTop'});await page.evaluate(()=>{document.querySelector('#scroll').style.left='8px';window.dispatchEvent(new Event('resize'));});await button.click();await page.waitForTimeout(160);assert.ok((await popup.getAttribute('class')).includes('overlay--right-start'));
  await render({placement:'leftTop',autoAdjustOverflow:false});await page.evaluate(()=>{document.querySelector('#scroll').style.left='8px';window.dispatchEvent(new Event('resize'));});await button.click();await page.waitForTimeout(160);assert.ok((await popup.getAttribute('class')).includes('overlay--left-start'));
  assert.deepEqual(errors,[]);console.log('PASS 嵌套滚动隐藏/恢复、贴边翻转与关闭自动避让');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
