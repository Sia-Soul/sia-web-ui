const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/mix7.html'));
  const preview=page.locator('.chart-mixed-pie-scatter');await preview.waitFor();
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const editor=preview.getByRole('textbox',{name:'图表数值数据'});
  const original=JSON.parse(await editor.inputValue());assert.equal(original[0].length,160);
  // Deterministic locations and values expose overlap, size and percentage errors.
  const values=Array.from({length:40},(_,i)=>[i%8-4,Math.floor(i/8)-2,12,8]).flat();
  await editor.fill(JSON.stringify([values]));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  await page.waitForTimeout(2200);
  const sectors=preview.locator('.sia-chart__sector');assert.equal(await sectors.count(),80);
  const first=preview.locator('[aria-label="坐标 1，系列1，12"]');await first.focus();
  assert.match(await preview.getByRole('tooltip').innerText(),/12 \(60%\)/);
  await preview.getByRole('button',{name:'系列1',exact:true}).click();assert.equal(await sectors.count(),40);
  await preview.getByRole('button',{name:'系列1',exact:true}).click();await page.waitForTimeout(2200);
  const before=await first.locator('path').boundingBox();
  await page.setViewportSize({width:1100,height:1100});await page.waitForTimeout(750);
  const after=await first.locator('path').boundingBox();
  assert.ok(before&&after);assert.ok(Math.abs(before.width-after.width)<.1);assert.ok(Math.abs(before.height-after.height)<.1);
  await preview.getByRole('button',{name:'标线',exact:true}).click();
  const point=await first.locator('path').boundingBox();
  await page.mouse.click(point.x+point.width/2,point.y+point.height/2);
  await page.mouse.click(point.x+point.width/2+70,point.y+point.height/2-35);
  assert.equal(await preview.locator('.sia-chart__user-marks line').count(),1);
  await preview.getByRole('button',{name:'撤销标线',exact:true}).click();
  assert.equal(await preview.locator('.sia-chart__user-marks line').count(),0);
  await preview.getByRole('button',{name:'标线',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');await preview.getByRole('button',{name:'保存为图片',exact:true}).click();
  const download=await downloadEvent;assert.equal(download.suggestedFilename(),'mix7.png');await download.saveAs(path.resolve('apps/docs/chart-mix7-export.png'));
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const zero=values.map((v,i)=>i%4>=2?0:v);
  await editor.fill(JSON.stringify([zero]));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  assert.equal(await sectors.count(),0);
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();assert.deepEqual(JSON.parse(await editor.inputValue()),original);
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  assert.deepEqual(errors,[]);console.log('mix7：160编辑值、40双扇区、60%提示、图例真实点击、缩放半径保持、导出及还原通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
