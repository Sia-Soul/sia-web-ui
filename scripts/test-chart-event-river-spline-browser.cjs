const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const original=await browser.newPage({viewport:{width:1600,height:1100}});
 await original.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver1.html');await original.locator('#main canvas').first().waitFor();await original.waitForTimeout(2300);
 const expected=await original.evaluate(()=>myChart.chart.eventRiver.shapeList.filter(shape=>shape.type==='polygon').map(shape=>({name:shape.style.text,color:shape.highlightStyle.color,points:require('zrender/shape/util/smoothSpline')(shape.style.pointList,true)})));
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver1.html'));
 const root=page.locator('.chart-event-river-reference');await root.scrollIntoViewIfNeeded();
 let total=0;
 for(const event of expected){const mark=root.locator(`[aria-label*="，${event.name}，"]`),shape=mark.locator('path'),d=await shape.getAttribute('d');const points=[...d.matchAll(/[ML]([^, ]+),([^ ]+)/g)].map(match=>[Number(match[1]),Number(match[2])]);assert.equal(points.length,event.points.length,event.name+'采样数');points.forEach((point,index)=>point.forEach((value,axis)=>assert.ok(Math.abs(value-event.points[index][axis])<1e-8,event.name+'采样坐标'+index)));total+=points.length;await mark.focus();assert.equal((await shape.evaluate(node=>getComputedStyle(node).fill)).replaceAll(' ',''),event.color.replaceAll(' ',''),'原站强调颜色');}
 console.log(`eventRiver1 原站6条轮廓、${total}个实际样条采样点逐坐标匹配通过。`);
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
