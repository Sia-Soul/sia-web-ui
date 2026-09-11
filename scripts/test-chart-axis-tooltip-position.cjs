const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();
 for(const [series,index] of [[3,0],[0,0],[2,11]]){
  const mark=root.locator(`[data-mixed-series="${series}"][data-mixed-index="${index}"]`);await mark.scrollIntoViewIfNeeded();const box=await mark.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await root.getByRole('tooltip').waitFor();
  const measured=await root.evaluate((root,{index,mouseY})=>{
   const host=root.querySelector('.sia-chart'),svg=host.querySelector('svg'),tip=host.querySelector('[role="tooltip"]'),bounds=host.getBoundingClientRect();
   const anchor=new DOMPoint(Math.round(80.5+(index+.5)*835/12),0).matrixTransform(svg.getScreenCTM());
   return {anchor:[anchor.x-bounds.left,mouseY-bounds.top],size:[tip.offsetWidth,tip.offsetHeight],host:[host.clientWidth,host.clientHeight],position:[parseFloat(tip.style.left),parseFloat(tip.style.top)],transform:getComputedStyle(tip).transform,transition:getComputedStyle(tip).transitionDuration};
  },{index,mouseY:box.y+box.height/2});
  let x=measured.anchor[0]+10,y=measured.anchor[1]+10;
  if(x+measured.size[0]>measured.host[0])x-=measured.size[0]+40;
  if(y+measured.size[1]>measured.host[1])y-=measured.size[1]-20;if(y<20)y=0;
  assert.ok(Math.abs(measured.position[0]-x)<.02&&Math.abs(measured.position[1]-y)<.02,JSON.stringify(measured));
  assert.equal(measured.transform,'none');assert.equal(measured.transition,'0.4s, 0.4s');
 }
 console.log('axis 分类中心横坐标、真实鼠标纵坐标、测量后边缘修正、移除默认上方transform、0.4s过渡配置通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
