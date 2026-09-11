const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartCityCycleSource.json')[0],entries=Object.entries(source.bindings.cityMap);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-city-cycle');await root.scrollIntoViewIfNeeded();
 const wait=async index=>{await page.waitForFunction(i=>document.querySelector('.chart-city-cycle')?.dataset.cityIndex===String(i),index);await root.locator('[data-map-region]').first().waitFor();assert.equal(await root.getAttribute('data-city-name'),entries[index][0]);const geo=JSON.parse(fs.readFileSync(`apps/docs/src/pages/chartCityMaps/${entries[index][1]}.json`,'utf8'));assert.deepEqual(await root.locator('[data-map-region]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mapRegion)),geo.features.map(f=>f.properties.name));};
 await wait(0);await root.locator('[data-map-region]').first().focus();assert.ok((await root.getByRole('tooltip').textContent()).startsWith('滚轮或点击切换'));
 await root.evaluate(n=>n.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true})));await wait(343);
 await root.evaluate(n=>n.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true})));await wait(0);
 for(let i=1;i<=8;i++){await root.locator('[data-map-region]').first().focus();await page.keyboard.press('Enter');await wait(i);}
 await root.evaluate(n=>{for(let i=0;i<40;i++)n.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));});await wait(48);
 for(let step=1;step<=344;step++){await root.evaluate(n=>n.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true})));await wait((48+step)%344);assert.equal(await root.locator('path[d*="NaN"],path[d*="Infinity"]').count(),0);if(step%100===0)console.log(`map20 已实际加载 ${step}/344 城市`);}
 await root.locator('[data-map-region]').first().click({force:true});await wait(49);
 const box=await root.locator('.sia-chart').boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5);await page.mouse.wheel(0,-100);await wait(48);
 assert.equal(await root.getByRole('link',{name:source.option.title.text,exact:true}).getAttribute('href'),source.option.title.link);
 assert.equal(await root.getByText('数值',{exact:true}).count(),0,'原页没有值域组件');
 assert.equal(await root.locator('[role="alert"]').count(),0);assert.deepEqual(errors,[]);await page.screenshot({path:'apps/docs/chart-map20-preparation.png'});console.log('map20 预览：北京/澳门循环、前八城市边界、区域键盘选择、40次快速滚轮后最终地图一致、提示通过；未注册。');
 await page.goto('http://localhost:4174/components/chart/map');const card=page.locator('#chart-example-map20');await card.scrollIntoViewIfNeeded();await card.locator('[data-map-region]').first().waitFor();assert.equal(await card.locator('.chart-city-cycle').getAttribute('data-city-name'),'北京市');assert.equal(await card.locator('[data-map-region]').count(),JSON.parse(fs.readFileSync('apps/docs/src/pages/chartCityMaps/110100.json','utf8')).features.length);assert.deepEqual(errors,[]);console.log('map20 全344地图逐项区域/有效路径、真实鼠标点击和滚轮、原链接/无值域及独立卡片通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
