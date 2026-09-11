const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const macro=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartMacroTimelineData.json','utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1700,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/bar11.html'));
  const preview=page.locator('.chart-bar-timeline');
  await preview.getByRole('button',{name:'暂停时间轴',exact:true}).click();
  const timeline=preview.getByRole('slider',{name:'图表时间轴',exact:true});
  await timeline.focus();await timeline.press('Home');
  for(let index=0;index<10;index++){
   if(index)await timeline.press('ArrowRight');
   const year=String(2002+index);
   const expected=['GDP','房地产'].flatMap(name=>macro.provinces.map((province,i)=>`${name}，${i%2?'\n':''}${province}，${macro.tables[name==='GDP'?'dataGDP':'dataEstate'][year][i]}`)).sort();
   await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('.chart-bar-timeline [role="graphics-symbol"]:not([data-mixed-axis-tooltip])')].map(node=>node.getAttribute('aria-label')).sort())===JSON.stringify(expected),expected);
  }
  for(const name of ['金融','第一产业','第二产业','第三产业'])await preview.getByRole('button',{name,exact:true}).click();
  assert.equal(await preview.locator('[data-mixed-series]').count(),186);
  const allLabels=await preview.locator('[data-mixed-series]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
  for(const [name,key] of Object.entries({'GDP':'dataGDP','金融':'dataFinancial','房地产':'dataEstate','第一产业':'dataPI','第二产业':'dataSI','第三产业':'dataTI'})){
   for(let i=0;i<31;i++)assert.ok(allLabels.includes(`${name}，${i%2?'\n':''}${macro.provinces[i]}，${macro.tables[key]['2011'][i]}`));
  }
  for(const name of ['金融','第一产业','第二产业','第三产业'])await preview.getByRole('button',{name,exact:true}).click();
  await preview.getByRole('button',{name:'切换为折线图',exact:true}).click();
  assert.equal(await preview.locator('[role="graphics-symbol"]:not([data-mixed-axis-tooltip]) circle').count(),62);
  await preview.getByRole('button',{name:'切换为堆积',exact:true}).click();
  await preview.getByRole('button',{name:'切换为柱状图',exact:true}).click();
  assert.equal(await preview.locator('[role="graphics-symbol"]:not([data-mixed-axis-tooltip]) rect').count(),62);
  await preview.getByRole('button',{name:'切换为平铺',exact:true}).click();
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const editor=preview.getByRole('textbox',{name:'图表数值数据'});
  const values=JSON.parse(await editor.inputValue());assert.equal(values.length,6);assert.ok(values.every(row=>row.length===31));
  values[0][0]=12345;values[0][1]=null;
  await editor.fill(JSON.stringify(values));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  assert.equal(await preview.locator('[aria-label="GDP，北京，12345"]').count(),1);
  assert.equal(await preview.locator('[role="graphics-symbol"]:not([data-mixed-axis-tooltip]):not([aria-label$="空槽"])').count(),61);
  values[0][1]=9876;
  await editor.fill(JSON.stringify(values));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  assert.equal(await preview.locator('[role="graphics-symbol"]:not([data-mixed-axis-tooltip])').count(),62);
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('.chart-bar-timeline [aria-label="GDP，北京，4315"]'));
  await preview.locator('[data-mixed-axis-tooltip="0"]').focus();
  const tooltip=preview.getByRole('tooltip');
  await tooltip.waitFor();
  const text=await tooltip.innerText();
  assert.ok(text.includes('GDP：4315'));assert.ok(text.includes(`房地产：${macro.tables.dataEstate['2002'][0]}`));
  assert.ok(!text.includes('金融：'));
  await preview.screenshot({path:'apps/docs/chart-bar11-preview.png'});
  assert.deepEqual(errors,[]);
  console.log('bar11：十年默认 620 值、2011 全选 186 值、图形切换、空值编辑及首年还原通过。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
