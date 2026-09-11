const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartMapSwitchSource.json')[0],china=require('../apps/docs/src/pages/chartChinaSource.json').geography;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));
 const preview=page.locator('.chart-map-switch');await preview.scrollIntoViewIfNeeded();
 const waitMap=async name=>{await page.waitForFunction(name=>{const root=document.querySelector('.chart-map-switch');return root?.getAttribute('data-map-type')===name&&root.querySelectorAll('[data-map-region]').length>0},name);};
 const wheel=async delta=>{const box=await preview.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+200);await page.mouse.wheel(0,delta);};
 await waitMap('china');assert.equal(await preview.locator('[data-map-region]').count(),34);
 await preview.locator('[data-map-region="广东"]').focus();await page.keyboard.press('Enter');await waitMap('广东');
 const capture=()=>preview.locator('[data-map-region]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-map-region'),n.getAttribute('aria-label'),n.querySelector('path').getAttribute('fill')]));
 const first=await capture();assert.ok(first.some(row=>row[1].includes('，')&&!row[1].includes('无数据')));
 const legend=preview.getByRole('button',{name:'随机数据',exact:true});
 await legend.click();assert.equal(await preview.locator('[data-map-transform]').isVisible(),false);
 assert.equal(await preview.getByRole('slider').count(),2);await legend.click();assert.deepEqual(await capture(),first);
 await preview.getByRole('slider').first().focus();await page.keyboard.press('End');
 assert.equal(await preview.getByRole('slider').first().getAttribute('aria-valuenow'),'1000');
 for(const row of first){if(row[1].includes('无数据')||row[1].includes('，1k'))continue;assert.equal(await preview.locator(`[data-map-region="${row[0]}"] path`).getAttribute('fill'),'#ccc');}
 await preview.locator('[data-map-region]').first().focus();await page.keyboard.press('Enter');await waitMap('china');
 await wheel(100);await waitMap('广东');assert.deepEqual(await capture(),first);
 assert.equal(await preview.getByRole('slider').first().getAttribute('aria-valuenow'),'0');
 await legend.click();await wheel(100);await waitMap('青海');assert.ok(await preview.locator('[data-map-transform]').isVisible());
 await wheel(-100);await waitMap('广东');assert.deepEqual(await capture(),first);
 for(let i=2;i<source.bindings.mapType.length;i++){
  await wheel(100);const name=source.bindings.mapType[i];await waitMap(name);
  const id=china.features.find(f=>f.properties.name===name).id,geo=require('../apps/docs/src/pages/chartProvinceMaps/'+id+'.json').geography;
  assert.deepEqual(await preview.locator('[data-map-region]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-map-region'))),geo.features.map(f=>f.properties.name));
 }
 await wheel(100);await waitMap('china');await wheel(-100);await waitMap('澳门');
 await preview.locator('[data-map-region]').first().focus();await page.keyboard.press('Enter');await waitMap('china');
 // Rapid events must commit only the final requested map, even when imports race.
 await preview.evaluate(node=>{for(let i=0;i<8;i++)node.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));});
 await waitMap('湖南');assert.equal(await preview.getByRole('alert').count(),0);
 await preview.screenshot({path:'apps/docs/chart-map3-preparation.png'});assert.deepEqual(errors,[]);
 console.log('map3：34省级真实地图滚轮循环、点击进入/返回、数据不重抽、反向循环和快速切换通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
