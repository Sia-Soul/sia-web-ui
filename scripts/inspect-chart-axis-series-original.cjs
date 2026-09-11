const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 await page.waitForTimeout(2500); // Original entry animation lasts 2 seconds; sample the settled geometry.
 console.log(JSON.stringify(await page.evaluate(()=>Object.fromEntries(['bar','line'].map(kind=>[kind,myChart.chart[kind].shapeList.map(shape=>({type:shape.type,z:shape.z,style:shape.style,highlightStyle:shape.highlightStyle}))])))));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
