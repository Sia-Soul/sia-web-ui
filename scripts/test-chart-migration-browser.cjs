const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartMigrationSource.json')[0];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-migration');await root.scrollIntoViewIfNeeded();
 for(const series of source.option.series.slice(1)){if(series.name!=='北京 Top10')await root.getByRole('button',{name:series.name,exact:true}).click();
  assert.equal(await root.locator('[data-map-line-series="全国"]').count(),150);assert.equal(await root.locator('[data-map-line]').count(),160);assert.equal(await root.locator('[data-map-point]').count(),10);assert.equal(await root.locator('[data-map-moving-effect]').count(),10);
  for(const datum of series.markPoint.data){const point=root.locator('[data-map-point="'+datum.name+'"]');assert.equal(await point.getAttribute('data-map-point-series'),series.name);await point.focus();assert.equal(await root.getByRole('tooltip').textContent(),datum.name);}
 }
 const dot=root.locator('[data-map-moving-effect]').first(),before=await dot.getAttribute('cx');await page.waitForFunction(value=>document.querySelector('.chart-migration [data-map-moving-effect]').getAttribute('cx')!==value,before);
 await page.waitForFunction(()=>document.querySelector('.chart-migration [data-map-trail="3"]')?.getAttribute('opacity')!=='0');
 const trail=root.locator('[data-map-effect-layer]').first();assert.equal(await trail.locator('[data-map-trail]').count(),104);
 assert.ok(Math.abs(Number(await trail.locator('[data-map-trail="0"]').getAttribute('opacity'))-.95)<1e-9);
 assert.ok(Math.abs(Number(await trail.locator('[data-map-trail="3"]').getAttribute('opacity'))-.95**4)<1e-9);
 const positions=await trail.locator('[data-map-trail]').evaluateAll(nodes=>nodes.filter(n=>Number(n.getAttribute('opacity'))>0).map(n=>n.getAttribute('cx')+','+n.getAttribute('cy')));assert.ok(new Set(positions).size>3,'拖尾保存多个真实运动帧');
 await root.getByRole('slider',{name:'值域下限',exact:true}).focus();await page.keyboard.press('End');assert.equal(await root.locator('[data-map-line]').count(),150);assert.equal(await root.locator('[data-map-point]').count(),0);
 assert.equal(await root.locator('[data-map-effect-layer]').count(),0,'过滤移除运动层及残影');
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await root.locator('[data-map-line-series="北京 Top10"]').count(),10);
 assert.equal(await root.locator('.sia-chart__heading strong').evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');
 assert.equal(await root.locator('.sia-chart__legend text').first().evaluate(n=>getComputedStyle(n).fill),'rgb(255, 255, 255)');
 assert.equal(await root.locator('[data-map-line-series="全国"] [data-map-line-start]').count(),0);assert.equal(await root.locator('[data-map-line-series="全国"] circle[data-map-line-end]').count(),150);
 assert.equal(await root.locator('[data-map-line-series="北京 Top10"] path[data-map-line-end]').count(),10);
 assert.equal(await root.locator('[data-map-inset] path').evaluate(n=>getComputedStyle(n).fill),'rgb(27, 27, 27)');
 assert.equal(await root.locator('[data-map-inset] text').evaluate(n=>getComputedStyle(n).fill),'rgb(255, 255, 255)');
 const downloading=page.waitForEvent('download');await root.getByRole('button',{name:'保存为图片',exact:true}).click();const download=await downloading;assert.equal(download.suggestedFilename(),'map11.png');await download.saveAs(path.resolve('apps/docs/chart-map11-export.png'));
 const city=root.locator('[data-map-point]').first();await city.focus();assert.equal(await city.locator('[data-map-point-label]').textContent(),await city.getAttribute('data-map-point'));
 const viewport=root.locator('[data-map-viewport]'),box=await viewport.boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+140,box.y+120,{steps:5});await page.mouse.up();assert.notEqual(await root.locator('[data-map-transform]').getAttribute('transform'),'translate(0 0) scale(1)');
 await viewport.focus();await page.keyboard.press('Home');await page.mouse.move(box.x+100,box.y+100);await page.mouse.wheel(0,-100);await page.waitForFunction(()=>document.querySelector('.chart-migration [data-map-transform]').getAttribute('transform').includes('scale(1.2)'));await root.getByRole('button',{name:'还原',exact:true}).click();
 await root.getByRole('button',{name:'数据视图',exact:true}).click();assert.deepEqual(JSON.parse(await root.getByRole('textbox',{name:'图表数值数据'}).inputValue()),[[],[],[],[]]);await root.getByRole('button',{name:'应用数据',exact:true}).click();await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();
 await root.getByRole('button',{name:'标线',exact:true}).click();const surface=await root.locator('[data-chart-mark-surface]').boundingBox();await page.mouse.click(surface.x+surface.width*.4,surface.y+surface.height*.4);await page.mouse.click(surface.x+surface.width*.6,surface.y+surface.height*.6);assert.equal(await root.locator('.sia-chart__user-marks line').count(),1);await root.getByRole('button',{name:'撤销标线',exact:true}).click();assert.equal(await root.locator('.sia-chart__user-marks line').count(),0);await root.getByRole('button',{name:'标线',exact:true}).click();
 const pixel=await page.evaluate(async()=>{const image=await createImageBitmap(await (await fetch('/chart-map11-export.png')).blob());const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(0,0,1,1).data];});assert.deepEqual(pixel,[27,27,27,255],'PNG导出必须保留深色背景');
 assert.deepEqual(errors,[]);await root.screenshot({path:'apps/docs/chart-map11-preparation.png'});
 await page.goto('http://localhost:4174/components/chart/map');const card=page.locator('#chart-example-map11');await card.scrollIntoViewIfNeeded();await card.locator('[data-map-line]').first().waitFor();assert.equal(await card.locator('[data-map-line]').count(),160);assert.equal(await card.locator('[data-map-point]').count(),10);
 console.log('map11：三组数据/提示、150背景+Top10、残影历史/衰减/清除、深色PNG像素、端点/标签、漫游/标线及独立卡片通过；完整视觉仍未验收。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
