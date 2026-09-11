const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartAirQualitySource.json')[0],series=source.option.series;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-air-quality');await root.scrollIntoViewIfNeeded();
 assert.equal(series[0].markPoint.data.length,190);assert.equal(series[1].markPoint.data.length,5);assert.equal(await root.locator('[data-map-point]').count(),195);
 for(const s of series)for(const d of s.markPoint.data){assert.ok(series[0].geoCoord[d.name]?.every(Number.isFinite));const point=root.locator('[data-map-point-series="'+s.name+'"][data-map-point="'+d.name+'"]');await point.focus();assert.equal(await root.getByRole('tooltip').textContent(),s.name+d.name+' : '+d.value);}
 assert.equal(await root.locator('[data-map-region][tabindex="-1"]').count(),34);
 assert.equal(await root.locator('[data-map-point-series="pm2.5"] path.sia-chart__map-point').count(),190);
 for(const d of series[1].markPoint.data){const point=root.locator('[data-map-point-series="Top5"][data-map-point="'+d.name+'"]'),circle=point.locator('.sia-chart__map-point'),duration=Number(await circle.getAttribute('data-map-scale-effect'));assert.ok(duration>=1500&&duration<2500);assert.equal(await circle.getAttribute('fill'),'none');assert.equal(await point.locator('animate[attributeName="opacity"]').count(),0);
  for(const progress of [.1,.5,.9]){const radius=await circle.evaluate((circle,{duration,progress})=>{const svg=circle.ownerSVGElement;svg.pauseAnimations();svg.setCurrentTime(duration/1000*progress);return circle.r.animVal.value;},{duration,progress});assert.ok(Math.abs(radius-(10+d.value/100)*2*(.1+.9*progress))<.03,'真实SVG中间帧缩放');}
  await circle.evaluate(circle=>circle.ownerSVGElement.unpauseAnimations());
 }
 const legend=root.getByRole('button',{name:'pm2.5',exact:true});await legend.click();assert.equal(await root.locator('[data-map-point-series="pm2.5"]').count(),0);assert.equal(await root.locator('[data-map-point-series="Top5"]').count(),5);await legend.click();
 await root.getByRole('slider',{name:'值域下限',exact:true}).focus();await page.keyboard.press('End');assert.equal(await root.locator('[data-map-point]').count(),0);await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await root.locator('[data-map-point]').count(),195);
 await root.getByRole('button',{name:'数据视图',exact:true}).click();const input=root.getByRole('textbox',{name:'图表数值数据'});assert.deepEqual(JSON.parse(await input.inputValue()),series.map(s=>s.markPoint.data.map(d=>d.value)));await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();
 await root.getByRole('button',{name:'数据视图',exact:true}).click();const rows=series.map(s=>s.markPoint.data.map(d=>d.value));rows[0][0]=500;rows[1][0]=300;await input.fill(JSON.stringify(rows));await root.getByRole('button',{name:'应用数据',exact:true}).click();await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();
 assert.equal(await root.locator('[data-map-point-series="pm2.5"][data-map-point="海门"] path').getAttribute('fill'),'#800000');
 assert.equal(await root.locator('[data-map-point-series="Top5"][data-map-point="廊坊"] animate[attributeName="r"]').getAttribute('values'),'2.6;26');
 await root.getByRole('button',{name:'还原',exact:true}).click();
 const viewport=root.locator('[data-map-viewport]'),box=await viewport.boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+140,box.y+120,{steps:5});await page.mouse.up();assert.notEqual(await root.locator('[data-map-transform]').getAttribute('transform'),'translate(0 0) scale(1)');await viewport.focus();await page.keyboard.press('Home');
 await page.mouse.move(box.x+100,box.y+100);await page.mouse.wheel(0,-100);await page.waitForFunction(()=>document.querySelector('.chart-air-quality [data-map-transform]').getAttribute('transform').includes('scale(1.2)'));
 await root.getByRole('button',{name:'还原',exact:true}).click();
 await root.getByRole('button',{name:'标线',exact:true}).click();const surface=await root.locator('[data-chart-mark-surface]').boundingBox();await page.mouse.click(surface.x+surface.width*.4,surface.y+surface.height*.4);await page.mouse.click(surface.x+surface.width*.6,surface.y+surface.height*.6);assert.equal(await root.locator('.sia-chart__user-marks line').count(),1);await root.getByRole('button',{name:'撤销标线',exact:true}).click();assert.equal(await root.locator('.sia-chart__user-marks line').count(),0);await root.getByRole('button',{name:'标线',exact:true}).click();
 const pending=page.waitForEvent('download');await root.getByRole('button',{name:'保存为图片',exact:true}).click();const download=await pending;assert.equal(download.suggestedFilename(),'map9.png');await download.saveAs(path.resolve('apps/docs/chart-map9-preparation.png'));
 await page.goto('http://localhost:4174/components/chart/map');const card=page.locator('#chart-example-map9');await card.scrollIntoViewIfNeeded();await card.locator('[data-map-point]').first().waitFor();assert.equal(await card.locator('[data-map-point]').count(),195);
 assert.deepEqual(errors,[]);console.log('map9：195原值、Top5缩放中间帧、图例、编辑、筛选、漫游、标线、导出与独立卡片通过。完整视觉一致性仍未验收。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
