const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartAirRoutesSource.json')[0],option=source.option;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-air-routes');await root.scrollIntoViewIfNeeded();
 assert.equal(await root.locator('[data-map-line]').count(),150);assert.equal(await root.locator('animateMotion').count(),0);
 for(const [index,series] of option.series.entries()){const lines=root.locator('[data-map-line-series="'+series.name+'"]');assert.equal(await lines.count(),[55,48,47][index]);
  for(const pair of series.markLine.data){const name=pair[0].name+' > '+pair[1].name;assert.ok(pair.every(p=>option.series[0].geoCoord[p.name]?.every(Number.isFinite)));const line=lines.locator('[data-map-line="'+name+'"]');const target=root.locator('[data-map-line-series="'+series.name+'"][data-map-line="'+name+'"]');await target.focus();assert.equal(await root.getByRole('tooltip').textContent(),name);assert.equal(await target.locator('path').first().getAttribute('stroke'),option.color[index]);assert.equal(await target.locator('path').first().getAttribute('stroke-dasharray'),'5 5');assert.equal(await target.locator('[data-map-line-start]').getAttribute('r'),'2');assert.equal(await target.locator('[data-map-line-end]').count(),1);}
 }
 await root.getByRole('button',{name:'北京',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),95);
 await root.getByRole('button',{name:'上海',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),47);
 await root.getByRole('button',{name:'广州',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),0);assert.equal(await root.locator('[data-map-transform]').evaluate(n=>n.style.display),'none');
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await root.locator('[data-map-line]').count(),150);
 const geo=require('../apps/docs/src/pages/chartChinaSource.json').geography,points=geo.features.flatMap(f=>f.geometry.type==='Polygon'?f.geometry.coordinates.flat():f.geometry.coordinates.flat(2));
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(700/((maxX-minX)*.75),440/(maxY-minY)),w=(maxX-minX)*scale*.75,h=(maxY-minY)*scale;
 const project=([x,y])=>[150+(700-w)/2+(x-minX)*scale*.75,65+(440-h)/2+(maxY-y)*scale];
 for(const series of option.series)for(const pair of series.markLine.data){
  const name=pair[0].name+' > '+pair[1].name,target=root.locator('[data-map-line-series="'+series.name+'"][data-map-line="'+name+'"]'),from=project(option.series[0].geoCoord[pair[0].name]),to=project(option.series[0].geoCoord[pair[1].name]),numbers=(await target.locator('path').first().getAttribute('d')).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
  const expected=[...from,(from[0]+to[0])/2,(from[1]+to[1])/2,...to];numbers.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-7,name+'投影端点与直线控制点'));
 }
 const originalPath=await root.locator('[data-map-line] path').first().getAttribute('d');
 await root.getByRole('button',{name:'数据视图',exact:true}).click();const input=root.getByRole('textbox',{name:'图表数值数据'});assert.deepEqual(JSON.parse(await input.inputValue()),[[],[],[]]);
 await input.fill('[[1],[],[]]');await root.getByRole('button',{name:'应用数据',exact:true}).click();assert.equal(await root.getByRole('alert').count(),1);
 await input.fill('[[],[],[]]');await root.getByRole('button',{name:'应用数据',exact:true}).click();assert.equal(await root.getByRole('status').textContent(),'数据已应用');await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();assert.equal(await root.locator('[data-map-line] path').first().getAttribute('d'),originalPath);
 const viewport=root.locator('[data-map-viewport]'),box=await viewport.boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+140,box.y+120,{steps:5});await page.mouse.up();assert.notEqual(await root.locator('[data-map-transform]').getAttribute('transform'),'translate(0 0) scale(1)');await viewport.focus();await page.keyboard.press('Home');
 await page.mouse.move(box.x+100,box.y+100);await page.mouse.wheel(0,-100);await page.waitForFunction(()=>document.querySelector('.chart-air-routes [data-map-transform]').getAttribute('transform').includes('scale(1.2)'));await root.getByRole('button',{name:'还原',exact:true}).click();
 await root.getByRole('button',{name:'标线',exact:true}).click();const surface=await root.locator('[data-chart-mark-surface]').boundingBox();await page.mouse.click(surface.x+surface.width*.4,surface.y+surface.height*.4);await page.mouse.click(surface.x+surface.width*.6,surface.y+surface.height*.6);assert.equal(await root.locator('.sia-chart__user-marks line').count(),1);await root.getByRole('button',{name:'撤销标线',exact:true}).click();assert.equal(await root.locator('.sia-chart__user-marks line').count(),0);await root.getByRole('button',{name:'标线',exact:true}).click();
 const pending=page.waitForEvent('download');await root.getByRole('button',{name:'保存为图片',exact:true}).click();const download=await pending;assert.equal(download.suggestedFilename(),'map10.png');await download.saveAs(path.resolve('apps/docs/chart-map10-preparation.png'));
 await page.goto('http://localhost:4174/components/chart/map');const card=page.locator('#chart-example-map10');await card.scrollIntoViewIfNeeded();await card.locator('[data-map-line]').first().waitFor();assert.equal(await card.locator('[data-map-line]').count(),150);
 assert.deepEqual(errors,[]);console.log('map10：150航线/投影几何/提示/图例、空系列编辑、真实漫游、标线、导出和分类卡片通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
