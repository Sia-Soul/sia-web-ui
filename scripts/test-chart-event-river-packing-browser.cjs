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
  const shapes=root.locator('path.sia-chart__event-river');assert.equal(await shapes.count(),6);
  const geometry=await shapes.evaluateAll(nodes=>nodes.map(node=>({center:Number(node.dataset.eventCenter),importance:Number(node.dataset.eventImportance),tail:Number(node.dataset.eventTail),path:node.getAttribute('d')})));
  assert.ok(geometry.every(item=>Number.isFinite(item.center)&&item.importance>0&&item.tail>0&&!/NaN|Infinity/.test(item.path)));
  assert.ok(geometry.every(item=>item.path.includes(' L')&&item.path.endsWith(' Z')),'离散样条闭合轮廓而非固定条带');
  for(const offset of [0,3])assert.ok(geometry[offset].importance>=geometry[offset+1].importance&&geometry[offset+1].importance>=geometry[offset+2].importance,'组内权重排序');
  const centers=geometry.map(item=>item.center).sort((a,b)=>a-b),gaps=centers.slice(1).map((value,index)=>Math.round((value-centers[index])*100));
  assert.ok(new Set(gaps).size>1,'原始事件的中心间距不是固定行高');
  await page.screenshot({path:'apps/docs/chart-event-river-preparation.png'});
  await root.locator('.sia-chart__legend').getByRole('button',{name:'财经事件',exact:true}).click();
  assert.equal(await shapes.count(),3);
  await page.waitForTimeout(600);
  const filtered=await shapes.evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.eventCenter)));
  assert.notDeepEqual(filtered,geometry.slice(3).map(item=>item.center),'图例筛选重新打包剩余事件');
  assert.deepEqual(errors,[]);
  console.log('eventRiver1：6事件、权重排序、非等距堆叠、闭合轮廓和图例重排通过；未注册。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
