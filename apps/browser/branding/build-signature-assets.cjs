/**
 * 从大魔王表情原稿导出网页与 Tauri 图标；按可见范围裁去留白后等比缩放，不改写五官颜色。
 * 运行方式：node build-signature-assets.cjs <sharp 模块路径>。
 */
const path = require('node:path');
const sharp = require(process.argv[2]);

async function main() {
  const publicDir = path.resolve(__dirname, '../public/brand');
  const wordmarkSource = path.join(__dirname, 'sia-demon-eyes-mouth.png');
  // 生成图在远离五官的位置存在极低透明度杂点；忽略 alpha ≤ 8 的定位噪点，保留轮廓周围 2px 抗锯齿余量。
  const { data, info } = await sharp(wordmarkSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('品牌原稿没有可见内容，停止导出。');
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(info.width - 1, right + 2); bottom = Math.min(info.height - 1, bottom + 2);
  const content = await sharp(wordmarkSource).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer();
  // 所有用途共用白色填充、黑色描边的表情原稿；保留原稿的轮廓和透明背景，不加底板、滤镜或额外轮廓。
  for (const size of [64, 256, 1024]) {
    const output = size === 1024 ? path.join(__dirname, 'sia-browser-source.png')
      : path.join(publicDir, size === 64 ? 'sia-browser-small.png' : 'sia-browser.png');
    // 眼睛和嘴巴保持完整并预留透明安全边距，避免小尺寸重采样触及画布边角。
    const inset = Math.ceil(size * 0.025);
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    await sharp(content).resize(size - inset * 2, size - inset * 2, { fit: 'contain', background: transparent })
      .extend({ top: inset, bottom: inset, left: inset, right: inset, background: transparent }).png().toFile(output);
  }
  // 沿用现有品牌入口文件名，标题栏和新标签页按原始宽高比显示同一图标。
  await sharp(content).resize({ width: 512 }).png().toFile(path.join(publicDir, 'sia-wordmark.png'));
  console.log('已导出大魔王品牌图片、64/256px 图标和 1024px 桌面源图。');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
