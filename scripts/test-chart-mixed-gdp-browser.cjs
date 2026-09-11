const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/mix3.html'));
  const preview=page.locator('.chart-mixed-gdp');await preview.scrollIntoViewIfNeeded();
  assert.equal(await preview.locator('[data-map-region]').count(),34);
  const inset=preview.locator('[data-map-inset="南海诸岛"]');
  assert.equal(await inset.count(),1);
  const insetPath=await inset.locator('path').getAttribute('d');
  assert.equal((insetPath.match(/M /g)||[]).length,12);
  assert.ok(!/NaN|Infinity/.test(insetPath));
  const wedges=preview.locator('[aria-label^="2011全国GDP对比，"]');
  assert.equal(await wedges.count(),3);
  assert.equal(await preview.locator('[aria-label="2011全国GDP对比，北京，16251.93"]').count(),1);
  const clickXinjiang=async()=>{const box=await preview.locator('[data-map-region="新疆"] text').boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);};
  await clickXinjiang();
  await preview.locator('[aria-label="2011全国GDP对比，新疆，6610.05"]').waitFor();
  assert.equal(await wedges.count(),4);
  assert.equal(await preview.locator('[aria-label="2011全国GDP对比，新疆，6610.05"]').count(),1);
  await clickXinjiang();
  await preview.locator('[aria-label="2011全国GDP对比，新疆，6610.05"]').waitFor({state:'hidden'});
  assert.equal(await wedges.count(),3);
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const editor=preview.getByRole('textbox',{name:'图表数值数据'}),rows=JSON.parse(await editor.inputValue());
  assert.equal(rows[0].length,31);assert.equal(rows[0][18],16251.93);
  rows[0][18]=17000;await editor.fill(JSON.stringify(rows));
  await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  assert.equal(await preview.locator('[aria-label="2011全国GDP对比，北京，17000"]').count(),1);
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  await page.screenshot({path:'apps/docs/chart-mix3-preview.png'});
  // Keyboard selection also reaches small regions without forcing pointer hits.
  const region=name=>preview.locator(`[data-map-region="${name}"]`);
  for(const name of ['北京','上海','广东']){await region(name).focus();await region(name).press('Enter');}
  await page.waitForFunction(()=>document.querySelectorAll('.chart-mixed-gdp [aria-label^="2011全国GDP对比，"]').length===0);
  const original=require('../apps/docs/src/pages/chartMixedGdpSource.json')[0].option.series[0].data;
  for(const item of original){await region(item.name).focus();await region(item.name).press('Space');}
  await page.waitForFunction(()=>document.querySelectorAll('.chart-mixed-gdp [aria-label^="2011全国GDP对比，"]').length===31);
  const names=await wedges.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label').split('，')[1]));
  assert.deepEqual(names,original.map(item=>item.name));
  for(const name of ['台湾','香港','澳门']){await region(name).focus();await region(name).press('Enter');}
  assert.equal(await wedges.count(),31,'无 GDP 数据地区不应虚构玫瑰图值');
  assert.equal(await region('澳门').getAttribute('aria-label'),'澳门，无数据');
  const legend=preview.locator('[aria-label="GDP 对比图例"]');
  const legendLabels=legend.locator('.sia-chart__legend text');
  assert.equal(await legendLabels.count(),31);
  const legendBox=await legend.boundingBox();assert.ok(legendBox);
  for(const label of await legendLabels.all()){
   const box=await label.boundingBox();assert.ok(box);
   assert.ok(box.y>=legendBox.y&&box.y+box.height<=legendBox.y+legendBox.height,'图例文字不能被裁切');
  }
  await page.screenshot({path:'apps/docs/chart-mix3-all-regions.png'});
  const boxes=await preview.locator('.sia-chart__pie-label').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,name:node.textContent};}));
  assert.equal(boxes.length,31);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];
   assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`${a.name} 与 ${b.name} 标签重叠`);
  }
  assert.deepEqual(errors,[]);
  console.log('mix3 准备：34 区域、默认三地区、真实点击新疆增加/取消、31 值编辑与玫瑰图同步通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
