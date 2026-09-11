const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/mix5.html'));
  const preview=page.locator('.chart-province-selector');await preview.scrollIntoViewIfNeeded();
  const selector=preview.locator('svg[aria-label="全国省份选择器"]');
  assert.equal(await selector.locator('[data-map-region]').count(),34);
  assert.equal(await preview.locator('svg[aria-label$="省级地图"]').count(),0);
  const select=async name=>{const mark=selector.locator(`[data-map-region="${name}"]`);await mark.focus();await mark.press('Enter');};
  const provinces=require('../apps/docs/src/pages/chartChinaSource.json').geography.features;
  for(const province of provinces){
   const name=province.properties.name;await select(name);
   const detail=preview.locator(`svg[aria-label="${name} 省级地图"]`);await detail.waitFor();
   const source=JSON.parse(fs.readFileSync(`apps/docs/src/pages/chartProvinceMaps/${province.id}.json`,'utf8'));
   assert.equal(await detail.locator('[data-map-region]').count(),source.geography.features.length,name);
   assert.equal(await preview.locator('svg[aria-label$="省级地图"]').count(),1);
  }
  await select('澳门');
  await preview.locator('svg[aria-label$="省级地图"]').waitFor({state:'hidden'});
  assert.equal(await preview.locator('[aria-label="省级数据图例"]').count(),0);
  assert.equal(await preview.locator('[aria-label="省级数据色域"]').count(),0);
  await select('新疆');await select('广东');
  const detail=preview.locator('svg[aria-label="广东 省级地图"]');await detail.waitFor();
  assert.equal(await preview.locator('svg[aria-label$="省级地图"]').count(),1);
  await preview.getByRole('button',{name:'数据视图',exact:true}).click();
  const editor=preview.getByRole('textbox',{name:'图表数值数据'}),rows=JSON.parse(await editor.inputValue());assert.equal(rows[0].length,363);
  const index=require('../apps/docs/src/pages/chartProvinceSelectorCities.json').names.indexOf('广州市');assert.ok(index>=0);
  rows[0][index]=123;await editor.fill(JSON.stringify(rows));await preview.getByRole('button',{name:'应用数据',exact:true}).click();
  await preview.getByRole('button',{name:'关闭数据视图',exact:true}).click();
  assert.equal(await detail.locator('[data-map-region="广州市"]').getAttribute('aria-label'),'广州市，123');
  await preview.scrollIntoViewIfNeeded();await page.screenshot({path:'apps/docs/chart-mix5-preview.png'});
  assert.deepEqual(errors,[]);
  console.log('mix5 准备：34 省逐项加载且区域数对应、取消清理、快速切换、363 值编辑联动通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
