/**
 * 从已确认的 S1-E 图稿导出网页尺寸与 Tauri 图标源图；只缩放，不重新绘制字形。
 * 运行方式：node build-signature-assets.cjs <sharp 模块路径>。
 */
const path = require('node:path');
const sharp = require(process.argv[2]);

async function main() {
  const publicDir = path.resolve(__dirname, '../public/brand');
  const wordmarkSource = path.join(__dirname, 'sia-signature-s1e-blue-bird.png');
  // 所有用途共用蓝青飞鸟与珍珠白签名的透明原稿；方形画布仅补透明留白，不添加底板或拉伸字形。
  for (const size of [64, 256, 1024]) {
    const output = size === 1024 ? path.join(__dirname, 'sia-browser-source.png')
      : path.join(publicDir, size === 64 ? 'sia-browser-small.png' : 'sia-browser.png');
    // 羽翼靠近原稿边缘；预留透明安全边距，避免小尺寸重采样触及画布边角。
    const inset = Math.ceil(size * 0.06);
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    await sharp(wordmarkSource).resize(size - inset * 2, size - inset * 2, { fit: 'contain', background: transparent })
      .extend({ top: inset, bottom: inset, left: inset, right: inset, background: transparent }).png().toFile(output);
  }
  // 横向字标保留透明背景和原始宽高比，标题栏和新标签页按比例显示。
  await sharp(wordmarkSource).resize({ width: 512 }).png().toFile(path.join(publicDir, 'sia-wordmark.png'));
  console.log('已导出 S1-E 横向字标、64/256px 图标和 1024px 桌面源图。');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
