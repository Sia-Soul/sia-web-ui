/** 按任务栏实际尺寸检查原生图标透明度和亮色笔画覆盖率，不借用网页 CSS 滤镜。 */
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require(path.join(process.argv[2], 'sharp'));
const source = path.resolve(__dirname, '../apps/browser/src-tauri/icons/icon.png');
/** sRGB 相对亮度，用于计算笔画与深色任务栏的对比。 */
function luminance(rgb) {
  return rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
(async () => {
  for (const size of [16, 24, 32, 48]) {
    const { data } = await sharp(source).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, '图标背景必须透明');
    let ink = 0, visible = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      ink++;
      const alpha = data[i + 3] / 255;
      const rgb = [0,1,2].map(c => data[i+c] * alpha + [29,33,39][c] * (1-alpha));
      if ((luminance(rgb) + .05) / (luminance([29,33,39]) + .05) >= 3) visible++;
    }
    const coverage = visible / ink;
    console.log(`${size}px: 亮色可辨笔画 ${(coverage * 100).toFixed(1)}%`);
    assert(ink > 0 && coverage >= .45, `${size}px 图标的亮色笔画不足，深色任务栏上难以辨认`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
