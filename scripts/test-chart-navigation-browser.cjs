const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const {chromium} = require(path.join(process.argv[2], 'playwright'));

function loadData(file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const module = {exports: {}};
  new Function('module', 'exports', output)(module, module.exports);
  return module.exports;
}

(async () => {
  const {chartCategories, chartCategoryForUrl} = loadData('apps/docs/src/pages/chartCategories.ts');
  const {chartReferenceExamples} = loadData('apps/docs/src/pages/chartReferenceExamples.ts');
  const browser = await chromium.launch({headless: true, executablePath: process.argv[3]});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.argv[4] || 'http://localhost:4174';
    await page.goto(base + '/components/chart/radar');
    const parent = page.getByRole('button', {name: 'Chart 图表', exact: true});
    const children = page.locator('#chart-category-navigation');
    assert.equal(await parent.getAttribute('aria-expanded'), 'true');
    assert.equal(await children.locator('a').count(), chartCategories.length + 1);
    for (const category of chartCategories) {
      const link = children.locator(`a[href="${category.path}"]`);
      await link.click();
      await page.waitForURL(base + category.path);
      await page.getByRole('heading', {name: category.title, exact: true, level: 1}).waitFor();
      assert.equal(await link.getAttribute('aria-current'), 'page');
      assert.equal(await children.locator('[aria-current="page"]').count(), 1);
      const expected = chartReferenceExamples.filter(entry => chartCategoryForUrl(entry.url) === category.id);
      const ids = await page.locator('.chart-reference-card').evaluateAll(nodes => nodes.map(node => node.id.replace('chart-example-', '')));
      const pending = await page.locator('.chart-reference-pending li').count();
      assert.equal(ids.length + pending, expected.length, category.id + ' 完整目录');
      for (const id of ids) {
        assert.ok(expected.some(entry => entry.url.endsWith('/' + id + '.html')), category.id + ' 不混入其他分类：' + id);
      }
      assert.equal(await page.locator('.chart-parity').count(), 0, '分类页不加载全部分类选择器');
      console.log(`${category.title}：${ids.length} 个图表，${pending} 个待实现入口`);
    }
    await page.reload();
    await children.waitFor();
    assert.equal(await children.locator('[aria-current="page"]').count(), 1);
    await parent.click();
    assert.equal(await children.count(), 0);
    await parent.click();
    await children.waitFor();
    await page.getByRole('button', {name: '收起侧边栏', exact: true}).first().click();
    assert.equal(await parent.getAttribute('aria-expanded'), 'false');
    await parent.click();
    assert.equal(await parent.getAttribute('aria-expanded'), 'true');
    assert.ok(await children.isVisible());
    await children.locator('a[href="/components/chart/bar"]').click();
    await page.getByRole('heading', {name: '柱状与条形图', exact: true, level: 1}).waitFor();
    await page.screenshot({path: 'apps/docs/chart-category-navigation.png'});
    await children.locator('a[href="/components/chart/pie"]').click();
    await page.waitForURL(base + '/components/chart/pie');
    await page.goBack();
    await page.getByRole('heading', {name: '柱状与条形图', exact: true, level: 1}).waitFor();
    assert.equal(await children.locator('a[href="/components/chart/bar"]').getAttribute('aria-current'), 'page');
    await page.goForward();
    await page.getByRole('heading', {name: '饼图、环图与玫瑰图', exact: true, level: 1}).waitFor();
    await page.setViewportSize({width: 390, height: 844});
    await page.getByRole('button', {name: '打开侧边栏', exact: true}).click();
    await children.locator('a[href="/components/chart/line"]').click();
    await page.getByRole('heading', {name: '折线与面积图', exact: true, level: 1}).waitFor();
    assert.equal(await page.locator('.docs-app.is-mobile-open').count(), 0, '移动端选择分类后关闭菜单');
    await page.getByRole('button', {name: '打开侧边栏', exact: true}).click();
    assert.equal(await children.locator('a[href="/components/chart/line"]').getAttribute('aria-current'), 'page');
    await children.locator('a[href="/components/chart"]').click();
    await page.getByRole('heading', {name: 'Chart 图表', exact: true, level: 1}).waitFor();
    assert.deepEqual(errors, []);
    console.log('21 个分类实际点击、完整归属、刷新选中、折叠、历史前进后退、移动端选择和全部图表入口检查通过。');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
