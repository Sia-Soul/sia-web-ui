const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/pie.html');await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2400);
 console.log(JSON.stringify(await page.evaluate(()=>({size:[document.querySelector('#main').clientWidth,document.querySelector('#main').clientHeight],marks:myChart.chart.pie.shapeList.filter(s=>s._mark!==undefined).map(s=>({type:s.type,style:s.style,highlightStyle:s.highlightStyle,draggable:s.draggable}))}))));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
