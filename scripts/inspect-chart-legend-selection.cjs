const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/legend.html');await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 const read=async(label)=>console.log(JSON.stringify({label,...await page.evaluate(()=>({selected:myChart.component.legend.getSelectedMap(),axes:myChart.component.yAxis._axisList.map(axis=>({min:axis._min,max:axis._max,labels:axis.shapeList.filter(s=>s.type==='text').map(s=>s.style.text)})),legend:myChart.component.legend.shapeList.filter(s=>s.type==='text').map(s=>({text:s.style.text,color:s.style.color}))}))}));
 const click=async(name)=>{const p=await page.evaluate(name=>{const s=myChart.component.legend.shapeList.find(s=>s.type==='text'&&s.style.text===name);const r=document.querySelector('#main canvas').getBoundingClientRect();return {x:r.x+s.style.x+5,y:r.y+s.style.y};},name);await page.mouse.move(p.x,p.y,{steps:5});await page.waitForTimeout(80);await page.mouse.click(p.x,p.y);await page.waitForTimeout(2600);};
 await read('initial');await click('最低气温');await read('missing once');await click('最低气温');await read('missing twice');await click('降水量');await read('rain shown');await click('最高气温');await read('temperature hidden');await click('蒸发量');await click('降水量');await read('all hidden');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
