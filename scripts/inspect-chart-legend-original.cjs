const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/legend.html');await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 console.log(JSON.stringify(await page.evaluate(()=>({legend:myChart.component.legend.shapeList.map(shape=>({type:shape.type,style:shape.style,clickable:shape.clickable})),selected:myChart.component.legend.getSelectedMap(),grid:myChart.component.grid.getArea(),axes:myChart.component.yAxis._axisList.map(axis=>({min:axis._min,max:axis._max,gap:axis._gap})),size:[myChart.getZrender().getWidth(),myChart.getZrender().getHeight()]}))));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
