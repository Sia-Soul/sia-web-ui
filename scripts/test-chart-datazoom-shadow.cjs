const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));const source=require('../apps/docs/src/pages/chartDataZoomSource.json');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto(source.url);await page.locator('#main canvas').first().waitFor();
 const expected=await page.evaluate(option=>{myChart.clear();myChart.setOption(option,true);const dz=myChart.component.dataZoom,shape=dz.shapeList.find(s=>s.type==='polygon');return {points:shape.style.pointList.map(([x,y])=>[x-dz._location.x,y-dz._location.y]),fill:shape.style.color};},source.option);
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();
 const polygon=root.locator('.sia-chart-data-zoom > svg polygon');const points=await polygon.evaluate(n=>n.getAttribute('points').split(' ').map(p=>p.split(',').map(Number)));
 assert.equal(points.length,152);assert.equal(points.length,expected.points.length);
 for(let i=0;i<points.length;i++){assert.ok(Math.abs(points[i][0]-expected.points[i][0])<1e-8);assert.equal(points[i][1],expected.points[i][1]);}
 assert.equal(expected.fill,'#efefff');assert.equal(await polygon.evaluate(n=>getComputedStyle(n).fill),'rgb(239, 239, 255)');
 assert.equal(await root.locator('.sia-chart-data-zoom__track').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)','轨道不遮盖阴影');
 assert.equal(await root.locator('.sia-chart-data-zoom__track i').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(182, 162, 222, 0.2)');
 await root.getByRole('slider',{name:'图表可见范围起点'}).fill('0');assert.deepEqual(await polygon.getAttribute('points'),points.map(p=>p.join(',')).join(' '),'缩放不裁剪概览阴影');
 console.log('dataZoom 同一150值样本的152个阴影顶点与原站逐点匹配，颜色及缩放后完整概览保留通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
