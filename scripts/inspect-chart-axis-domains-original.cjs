const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 console.log(JSON.stringify(await page.evaluate(()=>{
  const clone=value=>Array.isArray(value)?value.map(clone):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clone(item)])):value;
  const base=myChart.getOption(),cases=[{name:'initial'},{name:'hide-rain',hide:'降水量'},{name:'hide-high',hide:'最高气温'},{name:'edit-water',edit:[0,0,1000]},{name:'edit-temperature',edit:[3,0,100]},{name:'negative-water',edit:[0,0,-100]}];
  return cases.map(scenario=>{const option=clone(base);option.animation=false;option.legend.selected=Object.fromEntries(option.legend.data.map(name=>[name,name!==scenario.hide]));if(scenario.edit)option.series[scenario.edit[0]].data[scenario.edit[1]]=scenario.edit[2];myChart.clear();myChart.setOption(option,true);return {name:scenario.name,domains:[0,1].map(index=>{const axis=myChart.component.yAxis.getAxis(index);return {min:axis._min,max:axis._max,ticks:axis._valueList};})};});
 })));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
