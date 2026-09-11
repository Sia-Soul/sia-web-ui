const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['k','k1']){
   await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/'+id+'.html'));
   const chart=page.locator('.chart-parity__viewport').first();
   const candles=chart.locator('.sia-chart__candlestick');await candles.first().waitFor();
   const count=await candles.count();assert.ok(count>0);
   const mark=candles.first().locator('..');await mark.focus();
   assert.equal(await chart.locator('[data-candlestick-active-index]').count(),1);
   assert.match(await chart.getByRole('tooltip').innerText(),/开盘/);
   await chart.getByRole('button',{name:'还原',exact:true}).click();
   assert.equal(await candles.count(),count);
   assert.equal(await chart.locator('[data-candlestick-active-index]').count(),0);
   console.log(id+' 原有K线聚焦提示、高亮与还原通过');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
