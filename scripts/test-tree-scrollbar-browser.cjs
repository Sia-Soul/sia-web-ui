/** 验证 Tree 在没有全局 Provider 时接管滚动、响应展开收起并清理轨道。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge', ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage();
    // 此页面默认关闭全局 Provider，避免全局接管掩盖组件接入缺失。
    await page.goto('http://127.0.0.1:4173/components/floating-scrollbar');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Tree } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      const host = document.createElement('div');
      host.id = 'tree-scroll-fixture';
      host.style = 'position:fixed;inset:20px auto auto 20px;z-index:10000;background:white';
      document.body.append(host);
      window.treeScrollRoot = createRoot(host);
      window.treeScrollRoot.render(React.createElement(Tree, {
        style: { width: 260, maxHeight: 180, overflow: 'auto' },
        defaultExpandAll: true,
        stickyAncestors: true,
        treeData: [{ key: 'root', title: '滚动根节点', children: Array.from({ length: 20_000 }, (_, index) => ({ key: index, title: `节点 ${index}` })) }],
      }));
    });
    const tree = page.locator('#tree-scroll-fixture [role=tree]');
    await page.waitForFunction(() => document.querySelector('#tree-scroll-fixture [data-sia-tree-virtualized="true"]'));
    await page.waitForFunction(() => document.querySelector('#tree-scroll-fixture [data-sia-floating-scrollbar]'));
    // 两万条数据展开后，DOM 只保留视口和缓冲区附近的少量 treeitem。
    assert(await tree.getByRole('treeitem').count() < 40);
    assert.deepEqual(await tree.evaluate(el => [getComputedStyle(el).scrollbarWidth, el.offsetWidth - el.clientWidth]), ['none', 0]);
    await tree.hover();
    await page.mouse.wheel(0, 180);
    await page.waitForFunction(() => document.querySelector('#tree-scroll-fixture [role=tree]').scrollTop > 0);
    const track = page.locator('.sia-floating-scrollbar--vertical:not([hidden])');
    await track.waitFor({ state: 'visible' });
    // 拖动实际滑块，确认浮动轨道能够驱动原容器滚动。
    const thumb = await track.locator('.sia-floating-scrollbar__thumb').boundingBox();
    const before = await tree.evaluate(el => el.scrollTop);
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    assert(await tree.evaluate(el => el.scrollTop) > before);
    // 直接跳到四十多万像素后的末尾，确认窗口索引可达完整数据集且祖先仍吸顶。
    await tree.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
    await tree.getByRole('button', { name: '节点 19999', exact: true }).waitFor();
    assert.equal(await tree.getByRole('button', { name: '滚动根节点', exact: true }).count(), 1);
    const [treeBox, stickyRootBox] = await Promise.all([tree.boundingBox(), tree.locator('.sia-tree__virtual-sticky-node').boundingBox()]);
    assert(Math.abs(stickyRootBox.y - treeBox.y) < 2, `吸顶位置偏差：tree=${treeBox.y}, root=${stickyRootBox.y}`);
    assert(await tree.getByRole('treeitem').count() < 40);
    await tree.evaluate(el => { el.scrollTop = 0; });
    await tree.getByRole('button', { name: '收起节点' }).click();
    await page.waitForFunction(() => !document.querySelector('#tree-scroll-fixture [data-sia-floating-scrollbar]'));
    await tree.getByRole('button', { name: '展开节点' }).click();
    await page.waitForFunction(() => document.querySelector('#tree-scroll-fixture [data-sia-floating-scrollbar]'));
    assert(await tree.getByRole('treeitem').count() < 40);
    await page.evaluate(() => window.treeScrollRoot.unmount());
    // Portal 清理发生在 React 卸载提交后，等待浮动轨道从 body 移除。
    await page.waitForFunction(() => !document.querySelector('.sia-floating-scrollbar'));
    assert.equal(await page.locator('.sia-floating-scrollbar').count(), 0);
    console.log('PASS Tree 自动虚拟滚动与独立浮动滚动条：两万节点窗口化、不占宽度、滚轮、拖拽、展开收起及卸载清理');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
