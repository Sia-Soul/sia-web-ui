const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(path.join(process.argv[2], 'playwright'));
const source = require('../apps/docs/src/pages/chartAxisReferenceSource.json')[0].option;

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.argv[3]});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
    const errors = [], forbidden = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.resourceType() === 'script' && /(?:echarts|zrender)/i.test(request.url())) forbidden.push(request.url());
    });
    await page.goto('http://localhost:4174/components/chart/components');
    const card = page.locator('#chart-example-axis');
    await card.scrollIntoViewIfNeeded();
    await card.locator('.chart-axis-reference').waitFor();
    assert.equal(await page.locator('.chart-reference-card').count(), 3);
    assert.equal(await card.locator('[data-mixed-series][data-mixed-index]').count(), 48);
    assert.equal(await card.locator('.sia-chart__axis').count(), 4);
    assert.equal(await page.locator('.chart-reference-pending li').count(), 6);
    await card.getByRole('button', {name: '数据视图', exact: true}).click();
    assert.deepEqual(JSON.parse(await card.getByRole('textbox', {name: '图表数值数据'}).inputValue()), source.series.map(item => item.data));
    await card.getByRole('button', {name: '关闭数据视图', exact: true}).click();
    await card.getByRole('link', {name: '单独查看', exact: true}).click();
    await page.waitForURL(/reference=.*axis/);
    await page.locator('.chart-axis-reference').first().waitFor();
    assert.equal(await page.locator('.chart-axis-reference').first().locator('[data-mixed-series][data-mixed-index]').count(), 48);
    assert.deepEqual(errors, []);
    assert.deepEqual(forbidden, [], '本地页面不加载 ECharts/zrender 脚本');
    console.log('axis 独立分类卡片、48原值、四轴、6个剩余入口、单独查看及无外部图表运行时请求检查通过。');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
