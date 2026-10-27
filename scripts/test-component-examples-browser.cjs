/** 在独立浏览器逐组挂载样例，捕获渲染异常并验证关键交互。传入 Playwright 安装路径与可选服务地址。 */
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.argv[3] || 'http://127.0.0.1:4197';
const groups = ['BasicExamples', 'NavigationExamples', 'FeedbackExamples', 'SelectionExamples', 'DateExamples', 'DisplayExamples', 'FormExamples', 'OverlayExamples', 'EditorExamples', 'UploadExamples', 'ChartExamples', 'ChartPrimitiveExamples', 'TransferExamples', 'ResultExamples', 'MediaExamples', 'GameExamples'];
(async () => {
  // 可选第四参数指定独立浏览器可执行文件，默认仍使用本机 Edge。
  const browser = await chromium.launch({ ...(process.argv[4] ? { executablePath: process.argv[4] } : { channel: 'msedge' }), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    for (const group of groups) {
      await page.goto(`${base}/components/property-examples?group=${group}`);
      await page.getByRole('heading', { name: '组件属性样例索引' }).waitFor();
      const preview = page.locator('#property-example-preview');
      await preview.waitFor();
      await preview.scrollIntoViewIfNeeded();
      await page.waitForTimeout(group === 'EditorExamples' ? 2500 : 400);
      assert.ok((await preview.innerText()).length > 60, `${group} 没有实际内容`);
      if (group === 'SelectionExamples') {
        await preview.getByRole('textbox', { name: '输入后点击清空' }).fill('测试清空');
      }
      if (group === 'OverlayExamples') {
        await preview.getByRole('button', { name: '打开配置弹框' }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: '返回', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert.match(await preview.innerText(), /弹框动画结束：false/);
      }
      if (group === 'FormExamples') {
        await preview.getByRole('button', { name: '添加联系人' }).click();
        assert.equal(await preview.getByRole('button', { name: '移除', exact: true }).count(), 2);
      }
      if (group === 'BasicExamples') {
        await preview.getByRole('button', { name: '填充样式与整行按钮' }).click();
        assert.match(await preview.innerText(), /点击整行按钮/);
      }
      if (group === 'ChartExamples') {
        const chartNames = ['BarChart', 'LineChart', 'CandlestickChart', 'KLineChart', 'ChordChart', 'ForceChart', 'ForceGraphChart', 'GraphChart', 'FunnelChart', 'GaugeChart', 'HeatmapChart', 'MapChart', 'MixedChart', 'PieChart', 'RadarChart', 'ScatterChart', 'ThemeRiverChart', 'EventRiverChart', 'TreeChart', 'TreemapChart', 'VennChart', 'WordCloudChart', 'LineShareChart', 'XYChart'];
        for (const name of chartNames) {
          await preview.getByRole('combobox', { name: '图表组件', exact: true }).click();
          await page.getByRole('option', { name, exact: true }).click();
          await page.waitForTimeout(120);
          assert.ok(await preview.locator('svg').count(), `${name} 没有 SVG`);
          assert.deepEqual(errors, [], `${name} 渲染异常`);
        }
        console.log('PASS 24 种图表切换');
      }
      assert.deepEqual(errors, [], `${group} 出现浏览器异常`);
      console.log(`PASS ${group}`);
    }
    await page.goto(`${base}/components/property-examples?component=Button`);
    await page.getByRole('textbox', { name: '筛选属性' }).fill('block');
    assert.equal(await page.getByRole('button', { name: '查看源码', exact: true }).count(), 1);
    await page.getByRole('button', { name: '查看源码', exact: true }).click();
    await page.locator('.demo-card').first().getByRole('button', { name: '查看代码', exact: true }).click();
    await page.locator('.demo-card').first().locator('pre').waitFor();
    assert.match(await page.locator('.demo-card').first().locator('pre').innerText(), /import/);
    assert.deepEqual(errors, []);
    console.log('PASS 属性筛选、源码展示与全部 16 组渲染');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
