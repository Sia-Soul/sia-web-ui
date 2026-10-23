/** 无头渲染正式品牌图片和 CSS，检查深色背景下主要笔画的实际颜色对比。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dependencies = process.argv[2];
const { chromium } = require(path.join(dependencies, 'playwright'));
const sharp = require(path.join(dependencies, 'sharp'));
const root = path.resolve(__dirname, '..');
/** sRGB 相对亮度用于衡量笔画与背景的对比，避免只检查 CSS 字符串。 */
function luminance(rgb) {
  return rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 200, height: 140 }, deviceScaleFactor: 2 });
    const css = fs.readFileSync(path.join(root, 'apps/browser/src/styles.css'), 'utf8');
    // 可传旧版图稿作为负例，验证检测能识别深色背景上的低对比笔画。
    const data = fs.readFileSync(process.argv[3] || path.join(root, 'apps/browser/public/brand/sia-wordmark.png')).toString('base64');
    await page.setContent(`<html data-sia-theme="dark"><style>${css}</style><body style="margin:0;background:rgb(29,33,39)"><img class="browser-brand-glyph" style="width:160px;height:100px" src="data:image/png;base64,${data}"></body></html>`);
    await page.waitForFunction(() => document.images[0].complete);
    const { data: pixels, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // 渐变没有占主导的单一颜色；按源图 alpha 选取实际笔画，排除透明留白与抗锯齿边缘。
    const layout = await page.locator('img').evaluate(img => {
      const rect = img.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
    });
    const scale = Math.min(layout.width / layout.naturalWidth, layout.height / layout.naturalHeight);
    const width = Math.round(layout.naturalWidth * scale * 2);
    const height = Math.round(layout.naturalHeight * scale * 2);
    const left = Math.round(layout.x * 2 + (layout.width * 2 - width) / 2);
    const top = Math.round(layout.y * 2 + (layout.height * 2 - height) / 2);
    const mask = await sharp(Buffer.from(data, 'base64')).resize(width, height).ensureAlpha().raw().toBuffer();
    const contrasts = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (mask[(y * width + x) * 4 + 3] < 200) continue;
      const index = ((top + y) * info.width + left + x) * info.channels;
      const rgb = [...pixels.subarray(index, index + 3)];
      contrasts.push((luminance(rgb) + .05) / (luminance([29,33,39]) + .05));
    }
    assert(contrasts.length > 0, '没有可见笔画');
    contrasts.sort((a, b) => a - b);
    const contrast = contrasts[Math.floor(contrasts.length / 2)];
    console.log(`深色笔画对比度中位数=${contrast.toFixed(2)}，采样=${contrasts.length}px`);
    assert(contrast >= 4.5, '深色主题品牌笔画对比不足 4.5:1');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
