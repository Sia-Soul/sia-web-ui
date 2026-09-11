const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/mix6.html'));
  const preview=page.locator('.chart-mixed-sales');await preview.waitFor();
  const bars=preview.locator('.sia-chart__bar');assert.equal(await bars.count(),14);
  for(const width of await bars.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('width'))))assert.equal(width,'6');
  assert.equal(await preview.locator('.sia-chart__bar[fill="red"]').count(),2);
  assert.equal(await preview.locator('.sia-chart__line[stroke-dasharray="7 5"]').count(),1);
  assert.equal(await preview.locator('.sia-chart__mark circle').count(),7);
  const labelXs=await preview.locator('.sia-chart__axis--bottom text').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('x'))));
  const pointXs=await preview.locator('.sia-chart__mark circle').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('cx'))));
  assert.equal(labelXs.length,pointXs.length);labelXs.forEach((x,index)=>assert.ok(Math.abs(x-pointXs[index])<1e-9));
  assert.equal(await preview.locator('.sia-chart__legend [role="button"]').count(),0);
  const legend=await preview.locator('.sia-chart__legend').textContent();
  assert.match(legend,/本周/);assert.match(legend,/上周/);assert.ok(!legend.includes('变化'));
  for(const [index,expected] of [[0,'+80'],[2,'-50'],[3,'-34']]){
   await preview.locator(`[data-mixed-axis-tooltip="${index}"]`).focus();
   assert.ok((await preview.getByRole('tooltip').innerText()).includes(expected));
  }
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const editor=preview.getByRole('textbox',{name:'图表数值数据'});
  const rows=JSON.parse(await editor.inputValue());assert.deepEqual(rows.map(row=>row.length),[7,7,7,7]);
  assert.deepEqual(rows,[[400,374,251,300,420,400,440],[320,332,301,334,360,330,350],[320,332,251,300,360,330,350],[80,42,50,34,60,70,90]]);
  rows[0][0]=410;await editor.fill(JSON.stringify(rows));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  assert.equal(await preview.locator('[aria-label="本周，周一，410"]').count(),1);
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  assert.equal(await preview.locator('[aria-label="本周，周一，400"]').count(),1);
  await preview.getByRole('button',{name:'切换为柱状图',exact:true}).click();
  assert.equal(await bars.count(),28);
  assert.equal(await preview.locator('.sia-chart__line').count(),0);
  const clipped=preview.locator('[data-mixed-plot]');
  assert.match(await clipped.getAttribute('clip-path'),/^url\(#sia-mixed-plot-/);
  const clip=preview.locator('clipPath rect');
  assert.equal(await clip.getAttribute('y'),'65');assert.equal(await clip.getAttribute('height'),'285');
  // A current-week bar extends below the fixed domain in geometry, but cannot hit outside its clip.
  assert.equal(await preview.locator('svg.sia-chart__svg').evaluate(svg=>{
   const p=new DOMPoint(100,370).matrixTransform(svg.getScreenCTM());
   return !!document.elementFromPoint(p.x,p.y)?.closest('[data-mixed-plot]');
  }),false);
  await preview.getByRole('button',{name:'切换为折线图',exact:true}).click();
  assert.equal(await bars.count(),0);assert.equal(await preview.locator('.sia-chart__line').count(),4);
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  assert.equal(await bars.count(),14);
  await preview.getByRole('button',{name:'标线',exact:true}).click();
  const svg=preview.locator('svg.sia-chart__svg');
  const clicks=await svg.evaluate(node=>[new DOMPoint(150,150),new DOMPoint(450,230)].map(p=>{const t=p.matrixTransform(node.getScreenCTM());return {x:t.x,y:t.y};}));
  for(const p of clicks)await page.mouse.click(p.x,p.y);
  assert.equal(await preview.locator('.sia-chart__user-marks line').count(),1);
  await preview.getByRole('button',{name:'撤销标线',exact:true}).click();
  assert.equal(await preview.locator('.sia-chart__user-marks line').count(),0);
  await preview.getByRole('button',{name:'标线',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');
  await preview.getByRole('button',{name:'保存为图片',exact:true}).click();
  const download=await downloadEvent;assert.equal(download.suggestedFilename(),'销售数据.png');
  await download.saveAs(path.resolve('apps/docs/chart-mix6-export.png'));
  await page.screenshot({path:'apps/docs/chart-mix6-preview.png'});
  assert.deepEqual(errors,[]);console.log('mix6：28 原值、透明基柱/6px 共宽、下降红柱、无符号虚线、只读图例、正负提示及编辑还原通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
