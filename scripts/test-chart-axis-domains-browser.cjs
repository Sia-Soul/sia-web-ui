const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const original=require('../apps/docs/src/pages/chartAxisReferenceSource.json')[0].option.series.map(series=>series.data);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();
 const labels=side=>root.locator('.sia-chart__axis--'+side+' .sia-chart__axis-label').allTextContents();
 const cases=[{edit:[0,0,1000],left:[0,200,400,600,800,1000,1200],right:[0,5,10,15,20,25,30,35,40,45,50]},{edit:[3,0,100],left:[0,50,100,150,200,250],right:[0,10,20,30,40,50,60,70,80,90,100]},{edit:[0,0,-100],left:[-100,0,100,200,300],right:[0,5,10,15,20,25,30,35,40,45,50]}];
 for(const scenario of cases){
  await root.getByRole('button',{name:'还原',exact:true}).click();
  await root.getByRole('button',{name:'数据视图',exact:true}).click();
  const data=original.map(row=>[...row]);data[scenario.edit[0]][scenario.edit[1]]=scenario.edit[2];
  await root.getByRole('textbox',{name:'图表数值数据'}).fill(JSON.stringify(data));await root.getByRole('button',{name:'应用数据',exact:true}).click();await root.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  assert.deepEqual(await labels('left'),scenario.left.map(n=>n+' ml'));assert.deepEqual(await labels('right'),scenario.right.map(n=>n+' °C'));
  assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),48);
 }
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.deepEqual(await labels('left'),[0,50,100,150,200,250].map(n=>n+' ml'));
 await root.locator('.sia-chart__legend [role="button"]').nth(1).click();
 assert.deepEqual(await labels('left'),[0,50,100,150,200].map(n=>n+' ml'),'隐藏降水量后缩小水量范围');
 await root.getByRole('button',{name:'还原',exact:true}).click();
 await root.locator('.sia-chart__legend [role="button"]').nth(3).click();
 assert.deepEqual(await labels('right'),['0','2.5','5.0','7.5','10.0','12.5','15.0','17.5','20.0','22.5','25.0'].map(n=>n+' °C'),'隐藏最高气温后的范围及小数位对齐');
 await root.getByRole('button',{name:'还原',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('axis 水量1000、温度100、负水量-100编辑后的左右刻度匹配原站观测，恢复初始范围通过。尚未全覆盖原站刻度算法边界情形。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
