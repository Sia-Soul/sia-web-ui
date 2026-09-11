const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/map.html',{waitUntil:'domcontentloaded'});await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 await page.locator('#main').screenshot({path:'apps/docs/chart-personalized-map-original.png'});
 console.log(JSON.stringify(await page.evaluate(()=>({size:[myChart.getZrender().getWidth(),myChart.getZrender().getHeight()],shapes:myChart.chart.map.shapeList.map(s=>({type:s.type,style:s.style,highlightStyle:s.highlightStyle,position:s.position,scale:s.scale})).filter(s=>s.type==='image'||s.type==='icon')}))));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
