const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartRailwaySource.json')[0];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-railway');await root.scrollIntoViewIfNeeded();
 assert.equal(Object.keys(source.option.series[1].geoCoord).length,65);
 assert.equal(await root.locator('[data-map-line]').count(),81,'原站初始两组均选中');
 for(const [index,series] of source.option.series.entries()){
  await root.getByRole('button',{name:series.name,exact:true}).click();
  const lines=root.locator('[data-map-line]');assert.equal(await lines.count(),[36,45][index]);assert.deepEqual(await lines.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-map-line'))),series.markLine.data.map(p=>p[0].name+' > '+p[1].name));
  for(const [i,pair] of series.markLine.data.entries()){assert.ok(pair.every(p=>source.option.series[1].geoCoord[p.name]?.every(Number.isFinite)));const line=lines.nth(i);await line.focus();assert.equal(await root.getByRole('tooltip').textContent(),pair[0].name+' > '+pair[1].name);assert.equal(await line.locator('circle[data-map-line-start]').getAttribute('r'),'1');assert.equal(await line.locator('circle[data-map-line-end]').getAttribute('r'),'1');assert.equal(await line.locator('[data-map-line-start]').evaluate(n=>getComputedStyle(n).fill),'rgb(255, 255, 255)');assert.equal(await line.locator('animateMotion').count(),0);}
  assert.equal(await root.locator('canvas[data-effect-count]').count(),1);assert.equal(Number(await root.locator('canvas').getAttribute('data-effect-count')),[36,45][index]);assert.equal(await root.locator('[data-map-trail]').count(),0);
 }
 assert.equal(await root.locator('[data-map-line="济南 > 青岛"]').count(),2);assert.equal(await root.locator('[data-map-line="兖州 > 日照"]').count(),2);
 await root.getByRole('button',{name:'八横通道',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),45,'再次单选不会取消');
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),81);
 const canvas=root.locator('canvas');assert.equal(await canvas.getAttribute('data-effect-count'),'81');
 await page.waitForFunction(()=>Number(document.querySelector('.chart-railway canvas').dataset.effectFrame)>5);
 const before=await canvas.evaluate(c=>c.toDataURL());await page.waitForFunction(value=>document.querySelector('.chart-railway canvas').toDataURL()!==value,before);
 const paint=await canvas.evaluate(c=>{const bytes=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let visible=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>0)visible++;return visible;});assert.ok(paint>100,'共享层真实绘制运动点和残影');
 await root.getByRole('button',{name:'数据视图',exact:true}).click();const input=root.getByRole('textbox',{name:'图表数值数据'});assert.deepEqual(JSON.parse(await input.inputValue()),[[],[]]);
 await input.fill('[[],[]]');await root.getByRole('button',{name:'应用数据',exact:true}).click();assert.equal(await root.getByRole('status').textContent(),'数据已应用');await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),81);
 const viewport=root.locator('[data-map-viewport]'),box=await viewport.boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+140,box.y+120,{steps:5});await page.mouse.up();assert.notEqual(await root.locator('[data-map-transform]').getAttribute('transform'),'translate(0 0) scale(1)');await viewport.focus();await page.keyboard.press('Home');
 await page.mouse.move(box.x+100,box.y+100);await page.mouse.wheel(0,-100);await page.waitForFunction(()=>document.querySelector('.chart-railway [data-map-transform]').getAttribute('transform').includes('scale(1.2)'));await root.getByRole('button',{name:'还原',exact:true}).click();
 await root.getByRole('button',{name:'标线',exact:true}).click();const surface=await root.locator('[data-chart-mark-surface]').boundingBox();await page.mouse.click(surface.x+surface.width*.4,surface.y+surface.height*.4);await page.mouse.click(surface.x+surface.width*.6,surface.y+surface.height*.6);assert.equal(await root.locator('.sia-chart__user-marks line').count(),1);await root.getByRole('button',{name:'撤销标线',exact:true}).click();assert.equal(await root.locator('.sia-chart__user-marks line').count(),0);await root.getByRole('button',{name:'标线',exact:true}).click();
 const downloading=page.waitForEvent('download');await root.getByRole('button',{name:'保存为图片',exact:true}).click();const download=await downloading;assert.equal(download.suggestedFilename(),'map12.png');await download.saveAs(path.resolve('apps/docs/chart-map12-preparation.png'));
 const exported=await page.evaluate(async()=>{const response=await fetch('/chart-map12-preparation.png'),bitmap=await createImageBitmap(await response.blob()),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);return {width:bitmap.width,height:bitmap.height,pixel:[...context.getImageData(2,2,1,1).data]};});assert.ok(exported.width>1000&&exported.height>500);assert.deepEqual(exported.pixel,[27,27,27,255]);
 await page.goto('http://localhost:4174/components/chart/map');const card=page.locator('#chart-example-map12');await card.scrollIntoViewIfNeeded();await card.locator('[data-map-line]').first().waitFor();assert.equal(await card.locator('[data-map-line]').count(),81);assert.equal(await card.locator('canvas').getAttribute('data-effect-count'),'81');
 assert.deepEqual(errors,[]);console.log('map12：65坐标、81原线段及重复项、提示/端点、单选、共享拖尾、数据视图、漫游、标线、深色导出和独立分类卡片通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
