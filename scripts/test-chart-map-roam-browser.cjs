const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/mix5.html'));
  const preview=page.locator('.chart-province-selector');await preview.scrollIntoViewIfNeeded();
  const selector=preview.locator('svg[aria-label="全国省份选择器"]');
  const findPoint=region=>region.evaluate(node=>{const box=node.getBoundingClientRect();for(let y=box.top+2;y<box.bottom;y+=4)for(let x=box.left+2;x<box.right;x+=4)if(document.elementFromPoint(x,y)?.closest('[data-map-region]')===node)return {x,y};return null;});
  const xinjiang=selector.locator('[data-map-region="新疆"]');
  let point=await findPoint(xinjiang);assert.ok(point);
  await page.mouse.move(point.x,point.y);await preview.getByRole('tooltip').waitFor();
  assert.equal(await preview.getByRole('tooltip').innerText(),'新疆');
  assert.equal(await xinjiang.locator('text').textContent(),'新疆');
  await page.mouse.click(point.x,point.y);
  const detail=preview.locator('svg[aria-label="新疆 省级地图"]');await detail.waitFor();
  const transform=svg=>svg.locator('[data-map-transform]').getAttribute('transform');
  const originalDetail=await transform(detail),originalSelector=await transform(selector);
  point=await findPoint(xinjiang);assert.ok(point);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+35,point.y+20,{steps:10});await page.mouse.up();
  assert.notEqual(await transform(selector),originalSelector);
  assert.equal(await xinjiang.getAttribute('aria-selected'),'true','拖动不应取消省份选择');
  assert.equal(await transform(detail),originalDetail,'全国拖动不改变省级视图');
  point=await findPoint(xinjiang);assert.ok(point);await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,-120);
  await page.waitForFunction(()=>document.querySelector('svg[aria-label="全国省份选择器"] [data-map-transform]').getAttribute('transform').includes('scale(1.12)'));
  assert.equal(await transform(detail),originalDetail);
  const selectorAfterZoom=await transform(selector);
  const region=detail.locator('[data-map-region]').first();point=await findPoint(region);assert.ok(point);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x-30,point.y+25,{steps:10});await page.mouse.up();
  assert.notEqual(await transform(detail),originalDetail);
  assert.equal(await transform(selector),selectorAfterZoom);
  await detail.locator('[data-map-viewport]').focus();await detail.locator('[data-map-viewport]').press('Home');
  assert.equal(await transform(detail),originalDetail);
  assert.deepEqual(errors,[]);
  console.log('地图真实鼠标：区域点击选省、区域拖动不误选、区域滚轮缩放、双图视图隔离和 Home 还原通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
