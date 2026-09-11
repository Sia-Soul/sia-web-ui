const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();const pointer=root.locator('[data-mixed-axis-pointer]');
 assert.equal(await pointer.count(),0);
 const first=root.locator('[data-mixed-series="3"][data-mixed-index="0"]');await first.focus();
 assert.equal(await pointer.getAttribute('x1'),'115');assert.equal(await pointer.getAttribute('x2'),'115');assert.equal(await pointer.getAttribute('y1'),'60.5');assert.equal(await pointer.getAttribute('y2'),'318.5');
 assert.equal(await pointer.getAttribute('stroke'),'#008acd');assert.equal(await pointer.getAttribute('stroke-width'),'2');assert.equal(await pointer.getAttribute('pointer-events'),'none');
 assert.ok(await pointer.evaluate(node=>[...node.closest('svg').querySelectorAll('[data-mixed-plot],.sia-chart__axis-overlay')].every(under=>Boolean(under.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING))),'指示线在图表/轴线之上');
 await first.press('Escape');assert.equal(await pointer.count(),0);
 await first.evaluate(node=>node.blur());await first.hover();assert.equal(await pointer.count(),1);
 await page.mouse.move(0,0);assert.equal(await pointer.count(),0);
 const last=root.locator('[data-mixed-series="2"][data-mixed-index="11"]');await last.focus();assert.equal(await pointer.getAttribute('x1'),'881');
 await root.getByRole('button',{name:'还原',exact:true}).focus();assert.equal(await pointer.count(),0);
 console.log('axis 指示线原站首点坐标/范围/样式匹配，末点移动、层级、焦点/鼠标/离开/Esc清除通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
