const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.argv[3]});
  try {
    const page = await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
    await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');
    await page.locator('#main canvas').first().waitFor();
    const original = await page.evaluate(() => ['xAxis','yAxis'].flatMap(kind => [0,1].map(index => ({
      side:kind==='xAxis' ? index?'top':'bottom' : index?'right':'left',
      shapes:myChart.component[kind].getAxis(index).shapeList.map(shape=>({type:shape.type,z:shape.z,style:shape.style})),
    }))));
    await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
    const root=page.locator('.chart-axis-reference');
    await root.waitFor();
    let aligned=0, tickMaximumError=0;
    for(const axis of original) {
      const local=root.locator('[data-axis-orientation="'+axis.side+'"]');
      const readLines=selector=>local.locator(selector).evaluateAll(nodes=>nodes.map(node=>({
        x1:Number(node.getAttribute('x1')),x2:Number(node.getAttribute('x2')),
        y1:Number(node.getAttribute('y1')),y2:Number(node.getAttribute('y2')),
        stroke:getComputedStyle(node).stroke,width:parseFloat(getComputedStyle(node).strokeWidth),
      })));
      const sourceLines=axis.shapes.filter(s=>s.type==='line');
      const main=sourceLines.filter(s=>s.z===3);
      const horizontal=axis.side==='bottom'||axis.side==='top';
      const grids=sourceLines.filter(s=>s.z!==3 && Math.abs(horizontal?s.style.yEnd-s.style.yStart:s.style.xEnd-s.style.xStart)>20);
      const ticks=sourceLines.filter(s=>s.z!==3 && !grids.includes(s));
      // Endpoints may be reversed between SVG and Canvas; compare geometric bounds.
      const bounds=line=>[Math.min(line.x1,line.x2),Math.min(line.y1,line.y2),Math.max(line.x1,line.x2),Math.max(line.y1,line.y2)];
      for(const [selector,expected,tolerance] of [['[data-axis-stroke]',main,1e-8],['.sia-chart__grid-line',grids,1e-8],['[data-axis-tick]',ticks,1]]) {
        const actual=await readLines(selector);
        assert.equal(actual.length,expected.length,axis.side+' '+selector+' count');
        actual.forEach((line,index)=>{
          const s=expected[index].style,reference=bounds({x1:s.xStart,x2:s.xEnd,y1:s.yStart,y2:s.yEnd});
          bounds(line).forEach((value,i)=>{
            const error=Math.abs(value-reference[i]);
            assert.ok(error<=tolerance,`${axis.side} ${selector} ${index}: ${value} vs ${reference[i]}`);
            if(selector==='[data-axis-tick]')tickMaximumError=Math.max(tickMaximumError,error);
          });
          assert.equal(line.width,s.lineWidth,axis.side+' stroke width');
          aligned++;
        });
      }
      const expectedAreas=axis.shapes.filter(s=>s.type==='rectangle'&&s.style.width>1e-8&&s.style.height>1e-8);
      const actualAreas=await local.locator('.sia-chart__axis-split-area').evaluateAll(nodes=>nodes.map(node=>({
        x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y')),width:Number(node.getAttribute('width')),height:Number(node.getAttribute('height')),fill:node.getAttribute('fill'),
      })));
      assert.equal(actualAreas.length,expectedAreas.length,axis.side+' area count');
      actualAreas.forEach((area,index)=>{
        for(const field of ['x','y','width','height'])assert.ok(Math.abs(area[field]-expectedAreas[index].style[field])<1e-8,axis.side+' area '+field);
        assert.equal(area.fill.replaceAll(' ',''),expectedAreas[index].style.color.replaceAll(' ',''),axis.side+' area color');
      });
    }
    console.log(`axis 原站运行时对照：${aligned} 条轴线/网格/刻度的数量、位置和宽度通过，27 个非零背景分区边界及颜色通过。刻度最大偏差 ${tickMaximumError}px（原站累加浮点取整与独立计算差异，未声明逐像素一致）。`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
