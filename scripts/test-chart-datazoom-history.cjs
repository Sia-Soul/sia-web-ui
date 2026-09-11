const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html'));
 const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();const back=root.getByRole('button',{name:'区域缩放后退',exact:true});
 const read=()=>root.getByRole('slider',{name:'图表可见范围整体移动'}).getAttribute('aria-valuetext');
 assert.equal(await back.isEnabled(),true);await back.click();assert.equal(await read(),'0 – 100');assert.equal(await back.isDisabled(),true);
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await read(),'40 – 60');assert.equal(await back.isEnabled(),true);
 await root.getByRole('button',{name:'框选缩放',exact:true}).click();
 const select=async()=>{const box=await root.locator('[data-chart-brush]').boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+20);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+60,{steps:5});await page.mouse.up();};
 await select();const first=await read();await select();const second=await read();assert.notEqual(first,second);
 await back.click();assert.equal(await read(),first);await back.click();assert.equal(await read(),'40 – 60');await back.click();assert.equal(await read(),'0 – 100');assert.equal(await back.isDisabled(),true);
 await root.getByRole('button',{name:'还原',exact:true}).click();await root.getByRole('slider',{name:'图表可见范围整体移动'}).focus();await page.keyboard.press('ArrowRight');assert.equal(await read(),'41 – 61');await back.click();assert.equal(await read(),'0 – 100','平移不增加框选历史');
 console.log('dataZoom 初始历史、连续两次框选逐级返回、退到全范围禁用、还原重建和拖动不入历史通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
