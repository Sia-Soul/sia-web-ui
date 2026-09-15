const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/space');
    const group = page.locator('.sia-space-compact').filter({ has: page.locator('.sia-select') });
    await group.waitFor();
    for (const width of [1440, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      const geometry = await group.evaluate(element => {
        const roots = [...element.querySelectorAll('.sia-select')];
        const triggers = roots.map(root => root.querySelector('.sia-select__trigger'));
        const [left, right] = triggers.map(trigger => trigger.getBoundingClientRect());
        return {
          leftWidth: left.width,
          gap: right.left - left.right,
          unused: element.getBoundingClientRect().right - right.right,
          rootsMatch: roots.every((root, index) => Math.abs(root.getBoundingClientRect().width - triggers[index].getBoundingClientRect().width) < 1),
          joinedCorners: [getComputedStyle(triggers[0]).borderTopRightRadius, getComputedStyle(triggers[1]).borderTopLeftRadius],
        };
      });
      assert.equal(geometry.leftWidth, 160, 'Explicit width must size the whole Select');
      assert(Math.abs(geometry.gap + 1) < 1, `Compact borders must overlap by 1px: ${JSON.stringify(geometry)}`);
      assert(Math.abs(geometry.unused) < 1, 'Flexible Select must fill the remaining space');
      assert(geometry.rootsMatch, 'Triggers must fill their layout containers');
      assert.deepEqual(geometry.joinedCorners, ['0px', '0px']);
    }
    await group.getByRole('combobox').first().click();
    await page.getByRole('option', { name: '排除标签' }).click();
    await group.getByRole('combobox').first().filter({ hasText: '排除标签' }).waitFor();
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'sia-select-compact-fixed.png') });
    console.log('Select Compact: fixed width, flex sizing, joined borders, and selection passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
