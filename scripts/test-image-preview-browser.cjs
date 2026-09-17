const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 用真实大图尺寸验证适配边界及工具条交互，不依赖外部图片服务。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/upload');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { ImagePreview } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/DataDisplay.tsx');
      const host = document.createElement('div'); document.body.append(host);
      const root = (dom.default ?? dom).createRoot(host);
      window.renderPreview = (width = 3000, height = 5000, open = true) => root.render(React.createElement(ImagePreview, {
        open, src: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#619bca"/></svg>`),
        onOpenChange: value => window.renderPreview(width, height, value),
      }));
      window.renderPreview();
    });
    const dialog = page.getByRole('dialog', { name: '图片预览' });
    const img = dialog.locator('img');
    const button = name => dialog.getByRole('button', { name, exact: true });
    async function checkFit() {
      await page.waitForFunction(() => {
        const img = document.querySelector('.sia-image-preview__stage img');
        if (!img || !img.complete || getComputedStyle(img).visibility !== 'visible') return false;
        const a = img.getBoundingClientRect(), b = img.parentElement.getBoundingClientRect();
        return a.width > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
      });
    }
    await checkFit();
    const initial = await img.boundingBox();
    const percentage = dialog.getByLabel('当前缩放比例');
    assert.equal(await percentage.textContent(), `${Math.round(initial.width / 3000 * 100)}%`);
    await button('放大').click();
    assert.ok((await img.boundingBox()).width > initial.width);
    assert.equal(await percentage.textContent(), `${Math.round((await img.boundingBox()).width / 3000 * 100)}%`);
    await button('适应窗口').click(); await checkFit();
    await button('向右旋转').click(); await checkFit();
    assert.ok(await img.evaluate(el => el.style.transform.includes('90deg')));
    await button('水平翻转').click();
    assert.ok(await img.evaluate(el => el.style.transform.includes('scale(-1, 1)')));
    await button('垂直翻转').click();
    assert.ok(await img.evaluate(el => el.style.transform.includes('scale(-1, -1)')));
    await button('向左旋转').click();
    await button('适应窗口').click();
    const bounds = await img.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2 + 30); await page.mouse.up();
    assert.ok(await img.evaluate(el => el.style.transform.includes('translate(40px, 30px)')));
    await button('关闭预览').click(); await dialog.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.renderPreview()); await checkFit();
    assert.ok(await img.evaluate(el => el.style.transform.includes('translate(0px, 0px) rotate(0deg) scale(1, 1)')));
    await page.evaluate(() => window.renderPreview(5000, 2000)); await checkFit();
    await page.setViewportSize({ width: 390, height: 700 }); await checkFit();
    const toolbar = await dialog.getByRole('toolbar').boundingBox();
    assert.ok(toolbar.x >= 0 && toolbar.x + toolbar.width <= 390);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    console.log('PASS: 超大横竖图适应窗口、工具条、旋转翻转缩放、拖动、重开重置、窄屏及 Esc 关闭。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
