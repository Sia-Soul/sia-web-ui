const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html');await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 console.log(JSON.stringify(await page.evaluate(()=>({url:location.href,code:document.querySelector('textarea').value,option:option,zoom:myChart.component.dataZoom._zoom,visibleCategories:myChart.component.xAxis._axisList[0].option.data,grid:myChart.component.grid.getArea()}))));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
