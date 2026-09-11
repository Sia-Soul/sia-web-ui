const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 const result=await page.evaluate(async()=>{
  const height=()=>Math.max(...myChart.chart.bar.shapeList.filter(s=>s.type==='rectangle').map(s=>s.style.height));
  const before=height();myChart.restore();const after=height();await new Promise(resolve=>setTimeout(resolve,200));const middle=height();await new Promise(resolve=>setTimeout(resolve,2100));return {before,after,middle,final:height()};
 });console.log(JSON.stringify(result));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
