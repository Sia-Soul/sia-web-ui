const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();const legend=root.locator('.sia-chart__legend');
 const shapes=()=>legend.locator('[role="button"]').evaluateAll(nodes=>nodes.map(node=>node.querySelector('circle')?'line':'rect'));
 assert.deepEqual(await shapes(),['rect','rect','line','line']);
 assert.deepEqual(await legend.locator('circle').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('fill'))),['#fff','#fff']);
 await root.getByRole('button',{name:'切换为柱状图',exact:true}).click();assert.deepEqual(await shapes(),['rect','rect','rect','rect']);
 await root.getByRole('button',{name:'切换为折线图',exact:true}).click();assert.deepEqual(await shapes(),['line','line','line','line']);
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.deepEqual(await shapes(),['rect','rect','line','line']);
 await legend.locator('[role="button"]').nth(2).click();assert.equal(await root.locator('[data-mixed-series="2"]').count(),0);assert.deepEqual(await shapes(),['rect','rect','line','line']);
 console.log('axis 图例按柱/线分别显示符号，切换、恢复及图例隐藏行为通过；尺寸/字体/定位仍待对齐。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
