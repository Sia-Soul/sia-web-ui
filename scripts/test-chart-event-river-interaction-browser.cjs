const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver1.html'));
  const root=page.locator('.chart-event-river-reference');await root.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.chart-event-river-reference [data-event-scale]')].every(node=>Number(node.dataset.eventScale)===1));
  const mark=root.locator('[aria-label="财经事件，阿里巴巴上市，123"]'),shape=mark.locator('path'),before=await shape.getAttribute('d');
  const box=await shape.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.6+35,box.y+box.height*.5+50,{steps:8});await page.mouse.up();
  const offset=Number(await mark.getAttribute('data-event-offset'));assert.ok(offset>20);
  assert.equal(await mark.getAttribute('transform'),`translate(0 ${offset})`,'水平位置固定');
  assert.equal(await shape.getAttribute('d'),before,'不修改时间/数值几何');
  await root.getByRole('button',{name:'还原',exact:true}).click();
  assert.equal(Number(await mark.getAttribute('data-event-offset')),0);
  await mark.focus();
  const tip=root.getByRole('tooltip'),link=tip.getByRole('link',{name:'百度指数',exact:true}).first();
  await link.hover();await page.waitForTimeout(350);assert.ok(await tip.isVisible(),'鼠标可进入提示框');
  await link.focus();await page.mouse.move(1550,100);await page.waitForTimeout(350);assert.ok(await tip.isVisible(),'链接焦点保持提示框');
  assert.ok((await link.getAttribute('href')).includes('baidu.com'));
  await link.press('Escape');assert.equal(await tip.count(),0);
  await mark.focus();await page.getByRole('heading',{name:'Chart 图表',exact:true}).click();await page.waitForTimeout(350);assert.equal(await tip.count(),0,'离开后关闭');
  await page.goto('http://localhost:4174/components/chart/eventriver');
  const card=page.locator('#chart-example-eventRiver1');await card.scrollIntoViewIfNeeded();
  await card.locator('path.sia-chart__event-river').first().waitFor();assert.equal(await card.locator('path.sia-chart__event-river').count(),6);
  assert.equal(await page.locator('.chart-reference-card').count(),2);
  assert.equal(await page.locator('.chart-reference-pending li').count(),0);
  assert.deepEqual(errors,[]);console.log('eventRiver1 纵向拖动、数据不变、还原、提示交互、分类独立卡片6事件与待实现分离通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
