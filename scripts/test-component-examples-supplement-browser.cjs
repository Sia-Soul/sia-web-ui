const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.argv[3] || 'http://127.0.0.1:4197';

// 验证索引之外的真实入口和交互，防止属性虽出现在 JSX 中却不能在文档页使用。
(async () => {
  const browser = await chromium.launch({ ...(process.argv[4] ? { executablePath: process.argv[4] } : { channel: 'msedge' }), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const visit = group => page.goto(`${base}/components/property-examples?group=${group}`);
    const preview = page.locator('#property-example-preview');
    const selectPanel = async name => {
      await page.getByRole('combobox', { name: '游戏面板', exact: true }).click();
      await page.getByRole('option', { name, exact: true }).click();
    };
    fs.mkdirSync(path.resolve('logs/component-examples'), { recursive: true });

    await visit('MediaExamples');
    await page.getByText('图片加载成功，onLoad 已触发', { exact: true }).waitFor();
    // Switch 使用 label 承接鼠标点击，避免将点击发送给被视觉轨道覆盖的原生输入。
    await preview.getByText('清空预览帧', { exact: true }).click();
    await page.getByText('没有帧；关闭“清空预览帧”恢复演示。', { exact: true }).waitFor();
    await preview.getByText('清空预览帧', { exact: true }).click();
    await page.getByRole('button', { name: '打开受控图片预览', exact: true }).click();
    await page.getByRole('button', { name: '下一张', exact: true }).click();
    assert.equal(await page.getByLabel('图片序号', { exact: true }).textContent(), '2 / 2');
    assert.equal(await page.getByRole('dialog', { name: '图片预览' }).getByRole('img').getAttribute('alt'), 'Sia 数据库应用图标');
    await page.getByRole('button', { name: '关闭预览', exact: true }).click();
    await preview.getByRole('button', { name: '预览图片', exact: true }).first().click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByLabel('图片序号', { exact: true }).textContent(), '2 / 2');
    await page.getByRole('button', { name: '关闭预览', exact: true }).click();
    await preview.screenshot({ path: 'logs/component-examples/media.png' });
    console.log('PASS 光标空态、图片加载事件、受控预览与图片组切换');

    await visit('NavigationExamples');
    await preview.getByRole('button', { name: '定位末项', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="自动定位网格菜单"]').scrollTop > 0);
    await preview.getByRole('button', { name: '定位首项', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="自动定位网格菜单"]').scrollTop === 0);
    console.log('PASS 网格菜单选中项自动滚动');

    await visit('FormExamples');
    await preview.getByLabel('填充表单备注').fill('示例验收');
    await preview.getByRole('button', { name: '保存填充表单', exact: true }).click();
    await preview.getByText('保存：{"remark":"示例验收"}', { exact: true }).waitFor();
    assert.equal(await preview.locator('.sia-form--fill').count(), 2);
    console.log('PASS 填充表单提交与查询表单属性');

    await visit('GameExamples');
    await page.getByRole('button', { name: '推进一个回合', exact: true }).click();
    await preview.getByText(/已推进回合，累计击败/).waitFor();
    await selectPanel('装备');
    await preview.getByRole('button', { name: '对比', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: '装备', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await preview.getByText('操作完成：equip', { exact: true }).waitFor();
    for (const name of ['角色信息', '完整战场', '独立六边形棋盘', '累计资源', '首领挑战', '战斗记录', '地图', '伙伴', '能力装配', '存档操作']) {
      await selectPanel(name);
      assert.equal(await preview.locator('.sia-game').count(), 1, `面板应成功挂载：${name}`);
    }
    // 导出下载的内容用于回填同一个示例，确认前不替换状态；无效文件应反馈失败。
    const downloadPromise = page.waitForEvent('download');
    await preview.getByRole('button', { name: '导出存档', exact: true }).click();
    const download = await downloadPromise;
    const save = fs.readFileSync(await download.path());
    assert.equal(JSON.parse(save.toString('utf8')).version, 1);
    await preview.locator('input[type="file"]').setInputFiles({ name: 'demo.json', mimeType: 'application/json', buffer: save });
    await page.getByRole('button', { name: '确认替换演示状态', exact: true }).click();
    await preview.getByText('已导入演示存档', { exact: true }).waitFor();
    await preview.locator('input[type="file"]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await preview.getByText(/导入失败：/).waitFor();
    await selectPanel('完整战场');
    await preview.getByRole('button', { name: '开始挂机', exact: true }).click();
    await preview.getByText(/已推进回合，累计击败/).waitFor();
    await preview.getByRole('button', { name: '暂停挂机', exact: true }).click();
    await preview.screenshot({ path: 'logs/component-examples/game.png' });
    await preview.getByText('使用完整游戏宿主', { exact: true }).click();
    await preview.getByRole('button', { name: '开始挂机', exact: true }).click();
    await preview.getByText(/完整宿主：等级 .*挂机中/).waitFor();
    await preview.getByRole('button', { name: '暂停挂机', exact: true }).click();
    await preview.getByText(/完整宿主：等级 .*已暂停/).waitFor();
    console.log('PASS 游戏全部面板、装备操作、存档导入导出和完整宿主状态回调');
    assert.deepEqual(errors, [], '新增示例不能产生浏览器运行异常');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
