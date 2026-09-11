const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html'));
 const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();await root.getByRole('button',{name:'框选缩放',exact:true}).click();const brush=root.locator('[data-chart-brush]');
 const read=()=>root.getByRole('slider',{name:'图表可见范围整体移动'}).getAttribute('aria-valuetext');
 const drag=async(dx,dy)=>{const points=await brush.evaluate((n,{dx,dy})=>{const m=n.ownerSVGElement.getScreenCTM(),x=+n.getAttribute('x')+100,y=+n.getAttribute('y')+100;return [[x,y],[x+dx,y+dy]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);return{x:p.x,y:p.y};});},{dx,dy});await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:4});await page.mouse.up();};
 for(const [x,y] of [[8,60],[60,8],[-8,-60],[-60,-8],[0,0]]){await drag(x,y);assert.equal(await read(),'40 – 60');assert.equal(await root.locator('[data-chart-brush-selection]').count(),0);}
 await root.getByRole('button',{name:'区域缩放后退',exact:true}).click();assert.equal(await read(),'0 – 100');assert.equal(await root.getByRole('button',{name:'区域缩放后退',exact:true}).isDisabled(),true,'无效选区没有生成历史');
 await root.getByRole('button',{name:'还原',exact:true}).click();await root.getByRole('button',{name:'框选缩放',exact:true}).click();await drag(-12,-12);assert.notEqual(await read(),'40 – 60');await root.getByRole('button',{name:'区域缩放后退',exact:true}).click();assert.equal(await read(),'40 – 60');
 console.log('dataZoom 窄/扁/反向/零尺寸选区拒绝且不记录历史，超过双向阈值的反向框选有效。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
