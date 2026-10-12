// --expression 输出供浏览器只读执行的测量表达式；传入测量 JSON 后核对真实渲染及边界数据。
const fs = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const expression = `Array.from(document.querySelectorAll('.icon-tile')).map(tile => {
  const svg = tile.querySelector('svg');
  const group = svg.firstElementChild;
  const bounds = svg.getBBox();
  const raw = group.getBBox();
  const scale = group.transform.baseVal.consolidate().matrix.a;
  return {
    name: tile.querySelector('.icon-tile__label').textContent,
    variant: tile.querySelector('.sia-icon').getAttribute('data-variant'),
    bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
    raw: [raw.x, raw.y, raw.width, raw.height],
    stroke: Number(svg.getAttribute('stroke-width')) * scale
  };
})`;
if (process.argv[2] === '--expression') {
  console.log(expression);
} else {
  if (!process.argv[2]) throw new Error('请传入图标目录的浏览器测量 JSON 路径；使用 --expression 获取只读表达式。');
  const requireUi = createRequire(resolve('packages/react/package.json'));
  const esbuild = createRequire(requireUi.resolve('tsup'))('esbuild');
  const measurements = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const source = `
    import assert from 'node:assert/strict';
    import { ICON_NAMES, FILLED_ICON_NAMES } from './packages/react/src/components/Icon';
    import { outlineIconBounds, filledIconBounds } from './packages/react/src/components/iconBounds';
    const measurements = ${JSON.stringify(measurements)};
    const expected = [...ICON_NAMES.map(name=>'outline:'+name), ...FILLED_ICON_NAMES.map(name=>'filled:'+name)].sort();
    assert.deepEqual(measurements.map(item=>item.variant+':'+item.name).sort(), expected, '完整覆盖所有名称和实心变体');
    for (const item of measurements) {
      const [x,y,w,h] = item.bounds;
      const near=(value,expected,label)=>assert.ok(Math.abs(value-expected)<0.001, item.name+' '+label+': '+value);
      near(Math.max(w,h),18,'最长边'); near(x+w/2,12,'水平居中'); near(y+h/2,12,'垂直居中');
      near(item.stroke,1.8,'默认描边');
      const sourceBounds=(item.variant==='filled'?filledIconBounds:outlineIconBounds)[item.name];
      item.raw.forEach((value,index)=>near(value,sourceBounds[index],'原始边界数据同步'));
    }
    console.log('PASS '+measurements.length+' icons: complete coverage, 18-unit body, centered, stroke preserved, source bounds current');
  `;
  // 这里只读取名称和几何数据，样式由实际浏览器测量覆盖，无需在 Node 中加载 CSS。
  const code = esbuild.buildSync({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'icon-geometry-test.ts'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},write:false}).outputFiles[0].text;
  const Module = require('node:module');
  const testModule = new Module(__filename, module);
  testModule._compile(code, __filename);
}
