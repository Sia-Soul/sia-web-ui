const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();
 const expected={0:['1','蒸发量 : 2','降水量 : 2.6','最低气温 : 2'],2:['1','蒸发量 : 2','降水量 : 2.6','最低气温 : 2'],3:['Jan','最高气温 : 12']};
 for(const mode of ['initial','bar','line']){
  if(mode!=='initial')await root.getByRole('button',{name:mode==='bar'?'切换为柱状图':'切换为折线图',exact:true}).click();
  for(const series of [0,2,3]){
   const mark=root.locator(`[data-mixed-series="${series}"][data-mixed-index="0"]`);
   await mark.focus();await root.getByRole('tooltip').waitFor();
   const text=(await root.getByRole('tooltip').innerText()).split('\n').map(line=>line.trim()).filter(Boolean);
   assert.deepEqual(text,expected[series],mode+' series '+series+' 正确分类轴内容');
   if(series===3)assert.match(await mark.getAttribute('aria-label'),/Jan/);
  }
 }
 await root.getByRole('button',{name:'还原',exact:true}).click();
 const high=root.locator('[data-mixed-series="3"][data-mixed-index="0"]');await high.hover();await root.getByRole('tooltip').waitFor();assert.equal((await root.getByRole('tooltip').innerText()).trim(),'Jan\n最高气温 : 12');
 const style=await root.getByRole('tooltip').evaluate(node=>{
  const s=getComputedStyle(node);return {fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,padding:s.padding,background:s.backgroundColor,color:s.color,border:s.borderWidth,radius:s.borderRadius,shadow:s.boxShadow,whiteSpace:s.whiteSpace,children:[...node.querySelectorAll('strong,span')].map(child=>{const c=getComputedStyle(child);return [c.fontSize,c.lineHeight,c.fontWeight,c.color];})};
 });
 assert.deepEqual(style,{fontSize:'14px',lineHeight:'20px',fontWeight:'400',padding:'5px',background:'rgba(50, 50, 50, 0.5)',color:'rgb(255, 255, 255)',border:'0px',radius:'4px',shadow:'none',whiteSpace:'nowrap',children:[['14px','20px','400','rgb(255, 255, 255)'],['14px','20px','400','rgb(255, 255, 255)']]});
 await root.locator('.sia-chart__legend [role="button"]').nth(1).click();
 await root.locator('[data-mixed-series="0"][data-mixed-index="0"]').focus();await root.getByRole('tooltip').waitFor();assert.equal((await root.getByRole('tooltip').innerText()).trim(),'1\n蒸发量 : 2\n最低气温 : 2');
 assert.deepEqual(errors,[]);console.log('axis 双分类轴标题/系列筛选，初始与柱线切换、键盘焦点、鼠标悬停、隐藏系列过滤通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
