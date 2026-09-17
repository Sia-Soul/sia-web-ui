const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

// 逐帧测量实际选中轮廓：位移未完成时宽度必须同步变化，避免只验证最终样式。
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/tabs');
    await page.locator('.sia-tabs--tech-line').first().waitFor();
    for (const target of [1, 0]) {
      const frames = await page.evaluate(async (index) => {
        const tabs = document.querySelector('.sia-tabs--tech-line');
        const shape = tabs.querySelector('.sia-tabs__indicator-shape');
        const read = () => { const r = shape.getBoundingClientRect(); return { x: r.x, width: r.width }; };
        const result = [read()];
        tabs.querySelectorAll('[role="tab"]')[index].click();
        const start = performance.now();
        await new Promise(resolve => {
          function sample() {
            result.push(read());
            if (performance.now() - start < 380) requestAnimationFrame(sample);
            else resolve();
          }
          requestAnimationFrame(sample);
        });
        return result;
      }, target);
      const first = frames[0], last = frames.at(-1);
      assert.ok(Math.abs(last.width - first.width) > 30, '示例必须包含明显不同的选项宽度');
      let intermediate = 0;
      for (const frame of frames) {
        const positionProgress = (frame.x - first.x) / (last.x - first.x);
        const widthProgress = (frame.width - first.width) / (last.width - first.width);
        assert.ok(Math.abs(positionProgress - widthProgress) < 0.03, '位移与宽度必须同步推进');
        if (positionProgress > 0.1 && positionProgress < 0.9) intermediate++;
      }
      assert.ok(intermediate >= 2, '必须测到移动中同时伸缩的帧');
    }
    // 长短标签共用固定倾角，背景不能随文字宽度发生横向变形。
    const shapes = await page.locator('.sia-tabs--tech-line .sia-tabs__tab-shape').evaluateAll(nodes => nodes.map(el => {
      const s = getComputedStyle(el);
      return { transform: s.transform, radius: s.borderRadius, width: el.getBoundingClientRect().width };
    }));
    assert.ok(shapes[1].width > shapes[0].width + 30);
    assert.equal(shapes[0].transform, shapes[1].transform);
    assert.equal(shapes[0].radius, '5px');
    assert.equal(shapes[1].radius, '5px');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.sia-tabs--tech-line .sia-tabs__indicator').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    console.log('PASS: 长短标签倾角与圆角一致，位移与宽度逐帧同步；减少动态效果时关闭动画。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
