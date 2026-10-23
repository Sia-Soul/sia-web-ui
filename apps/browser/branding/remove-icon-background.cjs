/**
 * 从保留的原始图标提取透明背景版本；只处理底板及抗锯齿混色，不重绘标志。
 * 参数依次为 sharp 模块路径、原始 PNG 路径和输出 PNG 路径。
 */
const sharp = require(process.argv[2]);

async function main() {
  const { data, info } = await sharp(process.argv[3]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const result = Buffer.from(data);
  const palettes = [[248, 247, 240], [105, 207, 199], [247, 187, 72]];
  const solid = new Uint8Array(width * height);
  // 先识别三个主体色的内部像素，限制抠图范围，避免把底板纹理误判为主体。
  for (let p = 0; p < solid.length; p++) {
    const i = p * 4;
    solid[p] = Number(data[i + 3] > 0 && palettes.some(c => c.every((v, k) => Math.abs(v - data[i + k]) < 28)));
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (solid[y * width + x]) continue;
    let nearest = null;
    let distance = Infinity;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx, ny = y + dy, d = dx * dx + dy * dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || d >= distance) continue;
      if (solid[ny * width + nx]) { nearest = (ny * width + nx) * 4; distance = d; }
    }
    if (nearest === null) { result.fill(0, i, i + 4); continue; }
    // 用邻近原始底色恢复边缘透明度，去掉原先抗锯齿中混入的深蓝色。
    const background = [0, 0, 0];
    let count = 0;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = (ny * width + nx) * 4;
      if (data[j + 3] && data[j] < 65 && data[j + 1] < 65 && data[j + 2] < 110) {
        for (let k = 0; k < 3; k++) background[k] += data[j + k];
        count++;
      }
    }
    const bg = count ? background.map(v => v / count) : [35, 43, 81];
    let numerator = 0, denominator = 0;
    for (let k = 0; k < 3; k++) {
      const delta = data[nearest + k] - bg[k];
      numerator += (data[i + k] - bg[k]) * delta;
      denominator += delta * delta;
    }
    const alpha = Math.max(0, Math.min(1, numerator / denominator));
    if (alpha < 0.035) { result.fill(0, i, i + 4); continue; }
    for (let k = 0; k < 3; k++) result[i + k] = Math.round(Math.max(0, Math.min(255, (data[i + k] - (1 - alpha) * bg[k]) / alpha)));
    result[i + 3] = Math.round(data[i + 3] * alpha);
  }
  await sharp(result, { raw: { width, height, channels: 4 } }).png().toFile(process.argv[4]);
  console.log(JSON.stringify({ output: process.argv[4], width, height, transparentPixels: result.filter((v, i) => i % 4 === 3 && v === 0).length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
