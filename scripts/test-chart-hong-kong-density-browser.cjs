const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartHongKongDensitySource.json')[0],geo=require('../apps/docs/src/pages/chartHongKongGeography.json').geography;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-hong-kong-density');await root.scrollIntoViewIfNeeded();
 assert.equal(geo.features.length,18);assert.equal(await root.locator('[data-map-region]').count(),18);
 const flatten=feature=>feature.geometry.type==='Polygon'?feature.geometry.coordinates.flat():feature.geometry.coordinates.flat(2);
 const points=geo.features.flatMap(flatten),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(700/((maxX-minX)*.75),390/(maxY-minY));
 const w=(maxX-minX)*scale*.75,h=(maxY-minY)*scale,px=110+(700-w)/2,py=65+(390-h)/2;
 const project=point=>[px+(point[0]-minX)/(maxX-minX)*w,py+h-(point[1]-minY)/(maxY-minY)*h];
 for(const original of ['Islands','Yau Tsim Mong']){const feature=geo.features.find(f=>f.properties.name===original),vertices=flatten(feature);
  const center=original==='Islands'?project(source.option.series[0].geoCoord.Islands):vertices.map(project).reduce((sum,p)=>[sum[0]+p[0]/vertices.length,sum[1]+p[1]/vertices.length],[0,0]);
  if(original==='Yau Tsim Mong')center[0]-=10;
  const label=root.locator(`[data-map-original-name="${original}"] text`);assert.ok(Math.abs(Number(await label.getAttribute('x'))-center[0])<1e-8);assert.ok(Math.abs(Number(await label.getAttribute('y'))-(center[1]+4))<1e-8);
 }
 for(const [original,translated] of Object.entries(source.option.series[0].nameMap)){const mark=root.locator(`[data-map-original-name="${original}"]`);assert.equal(await mark.getAttribute('data-map-region'),translated);const value=source.option.series[0].data.find(d=>d.name===translated).value;await mark.focus();assert.equal(await root.getByRole('tooltip').textContent(),translated+value+' (p / km2)');}
 assert.equal(await root.locator('[data-map-region="观塘"] path').getAttribute('fill'),'#ff4500');
 await root.getByRole('button',{name:'数据视图',exact:true}).click();assert.deepEqual(JSON.parse(await root.getByRole('textbox',{name:'图表数值数据'}).inputValue()),[source.option.series[0].data.map(d=>d.value)]);await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();
 const handle=root.getByRole('slider').first(),box=await handle.locator('path').boundingBox(),track=await root.locator('[data-range-track]').boundingBox(),target=root.locator('[data-map-region="离岛"] path'),before=await target.getAttribute('fill');
 await page.mouse.move(box.x+box.width-3,box.y+3);await page.mouse.down();await page.mouse.move(box.x+box.width-3,box.y+3-track.height*.5,{steps:6});assert.equal(await target.getAttribute('fill'),before);await page.mouse.up();assert.equal(await target.getAttribute('fill'),'#ccc');
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await handle.getAttribute('aria-valuenow'),'800');assert.equal(await target.getAttribute('fill'),before);
 await root.getByRole('button',{name:'数据视图',exact:true}).click();const input=root.getByRole('textbox',{name:'图表数值数据'}),edited=source.option.series[0].data.map(d=>d.value);edited[0]=25400;
 await input.fill(JSON.stringify([edited]));await root.getByRole('button',{name:'应用数据',exact:true}).click();await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();
 const central=root.locator('[data-map-region="中西区"]');assert.equal(await central.locator('path').getAttribute('fill'),'#ffff00');await central.focus();assert.equal(await root.getByRole('tooltip').textContent(),'中西区25400 (p / km2)');
 await root.getByRole('button',{name:'还原',exact:true}).click();await central.focus();assert.equal(await root.getByRole('tooltip').textContent(),'中西区20057.34 (p / km2)');
 await root.getByRole('button',{name:'标线',exact:true}).click();const surface=root.locator('[data-chart-mark-surface]'),markBox=await surface.boundingBox();await page.mouse.click(markBox.x+markBox.width*.4,markBox.y+markBox.height*.4);await page.mouse.click(markBox.x+markBox.width*.6,markBox.y+markBox.height*.6);assert.equal(await root.locator('.sia-chart__user-marks line').count(),1);
 await root.getByRole('button',{name:'撤销标线',exact:true}).click();assert.equal(await root.locator('.sia-chart__user-marks line').count(),0);await root.getByRole('button',{name:'标线',exact:true}).click();
 const downloading=page.waitForEvent('download');await root.getByRole('button',{name:'保存为图片',exact:true}).click();const download=await downloading;assert.equal(download.suggestedFilename(),'map6.png');await download.saveAs(path.resolve('apps/docs/chart-map6-export.png'));
 await page.mouse.move(10,10);await root.screenshot({path:'apps/docs/chart-map6-preparation.png'});assert.deepEqual(errors,[]);console.log('map6：18专用地区、原始密度/中文提示、观塘超上限色、非实时筛选与还原通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
