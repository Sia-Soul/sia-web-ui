const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html');await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(1500);
 const bounds=await page.evaluate(()=>{myChart.component.toolbox.__onDataZoom({target:myChart.component.toolbox._iconShapeMap.dataZoom});const r=document.querySelector('#main canvas').getBoundingClientRect(),g=myChart.component.grid.getArea();return {x:r.x+g.x,y:r.y+g.y};});
 await page.mouse.move(bounds.x+100,bounds.y+30);await page.mouse.down();await page.mouse.move(bounds.x+300,bounds.y+100,{steps:5});
 console.log(JSON.stringify(await page.evaluate(()=>{const tb=myChart.component.toolbox;tb.__onmousedown({event:{zrenderX:100,zrenderY:100}});return {style:tb._zoomShape.style,highlight:tb._zoomShape.highlightStyle};})));await page.mouse.up();
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
