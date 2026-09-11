const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/radar.html'));
  const viewport=page.locator('.chart-parity__viewport').first();
  await viewport.locator('.sia-chart__radar-series').first().waitFor();
  await viewport.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  const position=async(index)=>page.evaluate(index=>{
   const container=document.querySelector('.chart-parity__viewport');
   const target=container.querySelector(`[data-radar-panel="0"][data-radar-series="${index}"]`);
   const rect=target.getBoundingClientRect();
   for(let y=Math.max(rect.top,0)+1;y<Math.min(rect.bottom,innerHeight);y+=2)for(let x=Math.max(rect.left,0)+1;x<Math.min(rect.right,innerWidth);x+=2){
    const hit=document.elementFromPoint(x,y)?.closest('[data-radar-series]');
    if(hit===target)return {x,y};
   }
   throw new Error('No visible hit point for radar '+index);
  },index);
  const source=await position(0),destination=await position(1);
  await page.mouse.move(source.x,source.y);await page.mouse.down();
  await page.mouse.move(destination.x,destination.y,{steps:20});await page.mouse.up();
  await page.waitForTimeout(200);
  const names=await viewport.locator('[data-radar-series]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
  assert.equal(names.length,4);assert.ok(names.some(name=>name.includes('图二 & 图一')&&name.includes('110，11，0.6，-180，3000')));
  assert.ok(await page.getByRole('button',{name:'━ 图二 & 图一',exact:true}).isVisible());
  await viewport.getByRole('button',{name:'还原',exact:true}).click();
  await page.waitForTimeout(2200);
  assert.equal(await viewport.locator('[data-radar-series]').count(),5);
  const out=await position(0);await page.mouse.move(out.x,out.y);await page.mouse.down();await page.mouse.move(10,100,{steps:20});await page.mouse.up();
  await page.waitForTimeout(200);assert.equal(await viewport.locator('[data-radar-series]').count(),4);
  await viewport.getByRole('button',{name:'还原',exact:true}).click();
  assert.equal(await viewport.locator('[data-radar-series]').count(),5);
  assert.deepEqual(errors,[]);
  await page.goto('http://localhost:4174/components/chart/radar');
  await page.locator('#chart-example-radar').waitFor();
  assert.equal(await page.locator('[id^="chart-example-"]').count(),5);
  console.log('真实浏览器鼠标：图一合并到图二、名称/数据/图例同步、拖出删除及还原通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
