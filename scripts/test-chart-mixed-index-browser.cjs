const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartMixedIndexSource.json')[0];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));
  const preview=page.locator('.chart-mixed-index');await preview.scrollIntoViewIfNeeded();await page.waitForTimeout(2300);
  assert.equal(await preview.locator('.sia-chart__candlestick').count(),44);
  assert.equal(await preview.locator('.sia-chart__line').count(),1);
  assert.equal(await preview.locator('[data-value-axis]').count(),2);
  const visibleAmounts=source.option.series[0].data.slice(44);
  for(const [name,value] of [['最大值',Math.max(...visibleAmounts)],['最小值',Math.min(...visibleAmounts)]]){
   assert.equal(await preview.locator(`[aria-label="${name}，${value}"]`).count(),1);
  }
  const candle=preview.locator('.sia-chart__candlestick').first().locator('..');
  await candle.focus();
  const text=await preview.getByRole('tooltip').textContent();
  assert.ok(text.includes(source.option.xAxis[0].data[44]));
  for(const value of source.option.series[1].data[44])assert.ok(text.includes(String(value)));
  assert.ok(text.includes(String(source.option.series[0].data[44])));
  await preview.getByRole('button',{name:'上证指数',exact:true}).click();assert.equal(await preview.locator('.sia-chart__candlestick').count(),0);
  await preview.getByRole('button',{name:'上证指数',exact:true}).click();assert.equal(await preview.locator('.sia-chart__candlestick').count(),44);
  await preview.getByRole('button',{name:'切换为柱状图',exact:true}).click();assert.equal(await preview.locator('.sia-chart__bar').count(),44);assert.equal(await preview.locator('.sia-chart__candlestick').count(),44);
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  const slider=preview.getByRole('slider').first();await slider.focus();await page.keyboard.press('Home');
  assert.equal(await preview.locator('.sia-chart__candlestick').count(),88);
  for(let i=0;i<88;i++){
   const mark=preview.locator('.sia-chart__candlestick').nth(i).locator('..');
   await mark.focus();
   const tip=await preview.getByRole('tooltip').textContent();
   assert.ok(tip.includes(source.option.xAxis[0].data[i]));
   for(const value of source.option.series[1].data[i])assert.ok(tip.includes(String(value)),i+' OHLC '+value);
   assert.ok(tip.includes(String(source.option.series[0].data[i])),i+' 金额');
  }
  assert.equal(await preview.locator(`[aria-label="最大值，${Math.max(...source.option.series[0].data)}"]`).count(),1);
  await preview.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await preview.locator('.sia-chart__candlestick').count(),44);
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const input=preview.getByRole('textbox',{name:'图表数值数据'});
  const values=JSON.parse(await input.inputValue());assert.equal(values.length,88);
  values[44]=[2230,2231,2220,2240,9000000];
  await input.fill(JSON.stringify(values));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  await candle.focus();assert.match(await preview.getByRole('tooltip').textContent(),/9000000/);
  assert.match(await candle.getAttribute('aria-label'),/开盘 2230，收盘 2231/);
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  values[44][2]=9999;await input.fill(JSON.stringify(values));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  assert.match(await preview.getByRole('alert').textContent(),/最低值/);
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  assert.match(await candle.getAttribute('aria-label'),/开盘 2230，收盘 2231/);
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  await preview.getByRole('button',{name:'框选缩放',exact:true}).click();
  const brush=preview.locator('[data-chart-brush]'),box=await brush.boundingBox();
  await page.mouse.move(box.x+box.width*.75,box.y+box.height*.5);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5,{steps:15});await page.mouse.up();
  assert.equal(await preview.locator('.sia-chart__candlestick').count(),22);
  await page.keyboard.press('Escape');assert.equal(await brush.count(),0);
  await preview.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await preview.locator('.sia-chart__candlestick').count(),44);
  await page.waitForTimeout(2300);await page.screenshot({path:'apps/docs/chart-mix10-preparation.png'});
  const mean=preview.locator('[data-mixed-average-label]');
  assert.equal(await mean.count(),1);
  assert.equal(await mean.textContent(),Math.round(visibleAmounts.reduce((a,b)=>a+b,0)/44/10000)+' 万');
  assert.equal(await mean.evaluate(node=>node.closest('[clip-path]')),null);
  const downloadEvent=page.waitForEvent('download');await preview.getByRole('button',{name:'保存为图片',exact:true}).click();
  const download=await downloadEvent;assert.equal(download.suggestedFilename(),'mix10.png');await download.saveAs(path.resolve('apps/docs/chart-mix10-export.png'));
  assert.deepEqual(errors,[]);console.log('mix10准备：双轴、44/88日缩放、共用OHLC/金额提示、图例、柱线切换与还原通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
