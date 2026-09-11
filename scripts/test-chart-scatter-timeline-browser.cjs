const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const macro=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartMacroTimelineData.json','utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/scatter4.html'));
  const preview=page.locator('.chart-scatter-timeline');
  const timeline=preview.getByRole('slider',{name:'图表时间轴',exact:true});
  await timeline.waitFor();
  await preview.getByRole('button',{name:'暂停时间轴',exact:true}).click();
  await timeline.focus();await timeline.press('Home');
  for(let index=0;index<10;index++){
   if(index)await timeline.press('ArrowRight');
   const year=String(2002+index);
   await preview.locator('.sia-chart__heading strong').filter({hasText:`${year}全国宏观经济关联分析（GDP vs 房地产）`}).waitFor();
   const expected=macro.provinces.map((name,i)=>`${name}，${macro.tables.dataEstate[year][i]}，${macro.tables.dataGDP[year][i]}`).sort();
   await page.waitForFunction(({selector,expected})=>JSON.stringify([...document.querySelectorAll(selector)].map(node=>node.getAttribute('aria-label')).sort())===JSON.stringify(expected),{selector:'.chart-scatter-timeline [role="graphics-symbol"]',expected});
   assert.equal(await preview.locator('.sia-chart__point-label').count(),31);
   assert.equal(await preview.locator('.sia-chart__mark-line').count(),2);
  }
  await preview.getByRole('button',{name:'播放时间轴',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.chart-scatter-timeline input[aria-label="图表时间轴"]')?.value==='0');
  await preview.getByRole('button',{name:'暂停时间轴',exact:true}).click();
  await timeline.focus();await timeline.press('Home');
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const editor=preview.getByRole('textbox',{name:'图表数值数据'});
  const values=JSON.parse(await editor.inputValue());assert.equal(values[0].length,62);
  values[0][0]=100;values[0][1]=500;
  await editor.fill(JSON.stringify(values));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  assert.equal(await preview.locator('[aria-label="北京，100，500"]').count(),1);
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  assert.equal(await preview.locator(`[aria-label="北京，${macro.tables.dataEstate['2002'][0]}，4315"]`).count(),1);
  await preview.scrollIntoViewIfNeeded();
  await preview.screenshot({path:'apps/docs/chart-scatter4-preview.png'});
  assert.deepEqual(await preview.locator('.sia-chart__mark-line > line').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).stroke)),['rgb(255, 0, 0)','rgb(255, 0, 0)']);
  await page.goto('http://localhost:4174/components/chart/scatter');
  const card=page.locator('#chart-example-scatter4');
  await card.scrollIntoViewIfNeeded();
  await card.locator('.chart-scatter-timeline').waitFor();
  assert.equal(await page.locator('.chart-reference-card').count(),7);
  assert.deepEqual(errors,[]);
  console.log('scatter4：十年逐项核对 310 个坐标、31 标签/双均值、自动循环、暂停、编辑和还原通过。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
