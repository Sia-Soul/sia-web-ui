const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();const emphasis=root.locator('[data-mixed-axis-emphasis]');
 const check=async(name,x,y,color)=>{
  assert.equal(await emphasis.count(),1);assert.equal(await emphasis.getAttribute('data-mixed-axis-emphasis'),name);
  assert.ok(Math.abs(Number(await emphasis.getAttribute('cx'))-x)<1e-8);assert.ok(Math.abs(Number(await emphasis.getAttribute('cy'))-y)<1e-8);
  assert.equal(await emphasis.getAttribute('r'),'3');assert.equal(await emphasis.getAttribute('stroke-width'),'4');assert.equal(await emphasis.getAttribute('fill'),'#fff');assert.equal(await emphasis.getAttribute('stroke'),color);
 };
 await root.locator('[data-mixed-series="0"][data-mixed-index="0"]').focus();await check('最低气温',115.29166666666666,308.18,'#5ab1ef');
 await root.getByRole('button',{name:'还原',exact:true}).focus();assert.equal(await emphasis.count(),0);
 await root.locator('[data-mixed-series="3"][data-mixed-index="0"]').hover();await check('最高气温',115.29166666666666,256.58,'#ffb980');
 await page.mouse.move(0,0);assert.equal(await emphasis.count(),0);
 await root.locator('[data-mixed-series="0"][data-mixed-index="1"]').focus();await check('最低气温',184.875,307.148,'#5ab1ef');
 await root.locator('.sia-chart__legend [role="button"]').nth(2).click();await root.locator('[data-mixed-series="0"][data-mixed-index="0"]').focus();assert.equal(await emphasis.count(),0,'隐藏折线后不强调隐藏点');
 await root.getByRole('button',{name:'还原',exact:true}).click();await root.getByRole('button',{name:'切换为折线图',exact:true}).click();
 await root.locator('[data-mixed-series="0"][data-mixed-index="0"]').focus();assert.equal(await emphasis.count(),3,'全折线时底轴三个系列均关联');
 assert.ok(await emphasis.evaluateAll(nodes=>nodes.every(node=>node.getAttribute('data-mixed-axis-emphasis')!=='最高气温')),'不跨到顶轴');
 await root.locator('[data-mixed-series="0"][data-mixed-index="0"]').press('Escape');assert.equal(await emphasis.count(),0);
 console.log('axis 同轴关联强调、原站首点位置/大小/样式、跨月份、隐藏系列、全线三点联动、离开/Esc恢复通过；未声称复制原站同月份跨轴缓存残留。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
