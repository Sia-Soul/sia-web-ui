const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/mix8.html'));
  const preview=page.locator('.chart-mixed-market');await preview.waitFor();
  const candles=preview.locator('.sia-chart__candlestick');assert.equal(await candles.count(),44);
  const virtual=preview.locator('[data-market-panel="virtual"]');assert.equal(await virtual.locator('.sia-chart__bar').count(),44);
  const amount=preview.locator('[data-market-panel="amount"]');assert.equal(await amount.locator('[data-mixed-axis-tooltip]').count(),44);
  const prices=await preview.locator('[data-market-panel="index"] .sia-chart__axis--left text').allTextContents();
  assert.equal(new Set(prices).size,prices.length);assert.ok(prices.every(label=>!label.includes('k')));
  for(const panel of [amount,virtual]){
   assert.equal(await panel.locator('[data-mixed-average] path').count(),0);
   assert.equal(await panel.locator('[data-mixed-average] text').count(),0);
  }
  const dates=await preview.locator('[data-market-panel="index"] text.sia-chart__axis-label').evaluateAll(nodes=>nodes.filter(node=>node.textContent.includes('/')).map(node=>{const b=node.getBoundingClientRect();return b.bottom;}));
  const zoomBounds=await preview.locator('.sia-chart-data-zoom').first().boundingBox();
  assert.ok(zoomBounds.y>Math.max(...dates));
  for(const panel of [amount,virtual]){
   await panel.locator('[data-mixed-axis-tooltip="3"]').focus();
   assert.equal(await preview.locator('[data-mixed-active-index="3"]').count(),2);
   assert.equal(await preview.locator('[data-candlestick-active-index="3"]').count(),1);
   assert.match(await preview.getByRole('status').innerText(),/2013\/4\/10/);
   const tips=preview.getByRole('tooltip');assert.equal(await tips.count(),3);
   for(const text of await tips.allTextContents())assert.match(text,/2013\/4\/10/);
   assert.match(await preview.locator('[data-market-panel="index"]').getByRole('tooltip').innerText(),/开盘 : 2224.93/);
  }
  await candles.nth(5).locator('..').focus();assert.equal(await preview.locator('[data-mixed-active-index="5"]').count(),2);
  const hit=amount.locator('[data-mixed-axis-tooltip="4"]');await hit.scrollIntoViewIfNeeded();
  const box=await hit.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height*.7);
  assert.equal(await preview.getByRole('tooltip').count(),3);
  for(const text of await preview.getByRole('tooltip').allTextContents())assert.match(text,/2013\/4\/11/);
  await page.mouse.move(5,5);assert.equal(await preview.getByRole('tooltip').count(),0);
  for(const name of ['上证指数','成交金额','虚拟数据']){
   const start=preview.getByRole('slider',{name:name+'联动范围起点',exact:true});
   await start.focus();await start.press('Home');
   for(const other of ['上证指数','成交金额','虚拟数据'])assert.equal(await preview.getByRole('slider',{name:other+'联动范围起点',exact:true}).inputValue(),'0');
   assert.equal(await candles.count(),88);assert.equal(await virtual.locator('.sia-chart__bar').count(),88);
   await preview.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await candles.count(),44);
  }
  await preview.getByRole('button',{name:'上证指数',exact:true}).click();assert.equal(await candles.count(),0);
  await amount.locator('[data-mixed-axis-tooltip="2"]').focus();assert.equal(await preview.getByRole('tooltip').count(),2);
  await preview.getByRole('button',{name:'上证指数',exact:true}).click();assert.equal(await candles.count(),44);
  await preview.getByRole('button',{name:'虚拟数据',exact:true}).click();assert.equal(await virtual.locator('.sia-chart__bar').count(),0);
  await preview.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await virtual.locator('.sia-chart__bar').count(),44);
  assert.equal(await preview.getByRole('tooltip').count(),0);
  await preview.getByRole('button',{name:'切换为柱状图',exact:true}).click();
  assert.equal(await candles.count(),44);assert.equal(await amount.locator('.sia-chart__bar').count(),44);assert.equal(await virtual.locator('.sia-chart__bar').count(),44);
  await preview.getByRole('button',{name:'切换为折线图',exact:true}).click();
  assert.equal(await candles.count(),44);assert.equal(await amount.locator('.sia-chart__line').count(),1);assert.equal(await virtual.locator('.sia-chart__line').count(),1);
  assert.equal(await preview.locator('.sia-chart__bar').count(),0);
  assert.equal(await virtual.locator('[data-mixed-average]').count(),1);
  await preview.getByRole('slider',{name:'成交金额联动范围起点',exact:true}).focus();
  await preview.getByRole('slider',{name:'成交金额联动范围起点',exact:true}).press('Home');
  assert.equal(await candles.count(),88);assert.equal(await virtual.locator('[data-mixed-axis-tooltip]').count(),88);
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  assert.equal(await candles.count(),44);assert.equal(await amount.locator('.sia-chart__bar').count(),0);assert.equal(await amount.locator('.sia-chart__line').count(),1);assert.equal(await virtual.locator('.sia-chart__bar').count(),44);
  await page.screenshot({path:'apps/docs/chart-mix8-preparation.png'});
  await preview.getByRole('button',{name:'框选缩放',exact:true}).click();
  const brush=amount.locator('[data-chart-brush]');await brush.scrollIntoViewIfNeeded();
  const region=await brush.boundingBox();
  await page.mouse.move(region.x+region.width*.75,region.y+20);await page.mouse.down();
  await page.mouse.move(region.x+region.width*.25,region.y+60,{steps:8});
  assert.equal(await amount.locator('[data-chart-brush-selection]').count(),1);
  await page.mouse.up();
  assert.equal(await candles.count(),22);assert.equal(await virtual.locator('.sia-chart__bar').count(),22);
  const fraction=Number(await preview.getByRole('slider',{name:'上证指数联动范围起点',exact:true}).inputValue());assert.ok(Math.abs(fraction-62.5)<1);
  await page.mouse.move(region.x+region.width*.25,region.y+20);await page.mouse.down();
  await page.mouse.move(region.x+region.width*.75,region.y+60,{steps:8});await page.mouse.up();
  assert.equal(await candles.count(),12);assert.equal(await virtual.locator('.sia-chart__bar').count(),12);
  await brush.focus();await brush.press('Escape');assert.equal(await preview.locator('[data-chart-brush]').count(),0);
  await preview.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await candles.count(),44);
  await page.waitForTimeout(1500);
  const downloadEvent=page.waitForEvent('download');
  await preview.getByRole('button',{name:'保存为图片',exact:true}).click();
  const download=await downloadEvent;assert.equal(download.suggestedFilename(),'mix8.png');
  await download.saveAs(path.resolve('apps/docs/chart-mix8-export.png'));
  assert.deepEqual(errors,[]);console.log('mix8准备：三面板44日/88日同步窗口、三入口键盘缩放、双向活动日期、图例隐藏及还原通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
