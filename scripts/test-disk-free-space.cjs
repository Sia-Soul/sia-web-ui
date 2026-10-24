// 用法：node scripts/test-disk-free-space.cjs <包含 playwright 的 node_modules 路径> [开发服务地址]
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1380, height: 860 } });
    await page.goto(process.argv[3] || 'http://127.0.0.1:16460/');
    const free = page.locator('[data-treemap-key="disk-free-space"]');
    const start = () => page.getByRole('button', { name: '开始探测', exact: true }).click();
    const completed = () => page.getByText('探测完成', { exact: true }).waitFor();
    const back = () => page.getByRole('button', { name: '重新选择', exact: true }).click();

    await start();
    await free.waitFor();
    assert.match(await free.innerText(), /空闲空间\s+178\.40 GB/);
    assert.equal(await free.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(128, 201, 139)');
    await completed();
    await free.click();
    assert.equal(await page.locator('.node-inspector').count(), 0);
    await free.click({ button: 'right' });
    assert.equal(await page.getByRole('menu').count(), 0);

    // 原位展开保留空闲块；聚焦子文件夹只展示子树，还原后恢复空闲块。
    await page.locator('.sia-treemap__tile').filter({ has: page.getByText('Program Files', { exact: true }) }).click();
    assert.equal(await free.count(), 1);
    await page.getByRole('button', { name: '聚焦展开 Program Files', exact: true }).click();
    await free.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '还原 Program Files', exact: true }).click();
    await free.waitFor();

    await back();
    await page.getByText('Data (D:)', { exact: true }).click();
    await start();
    await completed();
    assert.match(await free.innerText(), /621\.80 GB/);

    // 演示模式的目录选择器返回 C:\Users\Demo\AppData\Local。
    await back();
    await page.getByRole('button', { name: '浏览目录', exact: true }).click();
    await start();
    await completed();
    assert.equal(await free.count(), 0);
    assert.equal(await page.locator('.treemap-legend').getByText('空闲空间').count(), 0);
    console.log('PASS：整盘空闲容量、绿色显示、点击与右键、展开与聚焦、切换磁盘、普通目录排除。');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
