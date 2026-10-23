/** 检查分组内部所有命中区域的进入、悬停与放置协议，覆盖节点边缘和缩进空白。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 820 } });
    await page.addInitScript(() => {
      const payload = {
        groups: [{ id: 'a', name: '环境', color: '#5548f6', smallGroups: [{ id: 'source', name: '来源' }, { id: 'target', name: '目标' }] }],
        tabs: ['source', 'target', 'target'].map((smallGroupId, index) => ({ id: `tab-${index}`, title: `页面 ${index}`, url: 'https://example.test/', groupId: 'a', smallGroupId })),
        activeId: 'tab-0', darkMode: false, panelExpanded: true, panelPinned: true, panelWidth: 400,
        closedTabCount: 0, collapsedGroupIds: [], collapsedSmallGroupIds: [],
      };
      window.dropRegionTest = { moves: [] };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        if (command === 'get_floating_tab_panel_state') return structuredClone(payload);
        if (command === 'floating_tab_panel_action' && args.action.action === 'move-tab') window.dropRegionTest.moves.push(JSON.parse(args.action.value));
      } } };
    });
    await page.goto('http://127.0.0.1:1440/tab-panel.html');
    await page.locator('[data-browser-tab-id="tab-0"]').waitFor();
    const failures = await page.evaluate(() => {
      const failures = [];
      const transfer = new DataTransfer();
      const source = document.querySelector('[data-browser-tab-id="tab-0"] .vertical-tree-tab__select');
      const fire = (element, type, x = 0, y = 0, relatedTarget = null) => {
        const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: x, clientY: y, relatedTarget });
        element.dispatchEvent(event);
        return event;
      };
      fire(source, 'dragstart');
      // 用逐像素纵向采样覆盖行与行交界，并分别扫过缩进、文字与行尾区域。
      for (const selector of ['.vertical-tree-group', '[data-drop-small-group="source"]', '[data-drop-small-group="target"]']) {
        const region = document.querySelector(selector);
        const rect = region.getBoundingClientRect();
        for (const x of [rect.left + 2, rect.left + 30, rect.left + rect.width / 2, rect.right - 3]) {
          for (let y = rect.top + 1; y < rect.bottom - 1; y++) {
            const hit = document.elementFromPoint(x, y);
            if (!hit || !region.contains(hit)) continue;
            for (const type of ['dragenter', 'dragover']) {
              const event = fire(hit, type, x, y);
              // 合成 DragEvent 的 dropEffect 在 Chromium 中不可写，接收协议检查 defaultPrevented；真实拖动在下方验证。
              if (!event.defaultPrevented) failures.push({ selector, type, x, y, hit: hit.className });
            }
          }
        }
      }
      fire(source, 'dragend');
      return failures.slice(0, 6);
    });
    assert.deepEqual(failures, [], '分组内所有位置应持续接受本树标签');
    const source = page.locator('[data-browser-tab-id="tab-0"] .vertical-tree-tab__select');
    // 真实拖动到第一行上半部，验证粗线与插入锚点一致，且横线不会拦截鼠标命中。
    const sourceBox = await source.boundingBox();
    const firstTarget = await page.locator('[data-browser-tab-id="tab-1"]').boundingBox();
    await page.mouse.move(sourceBox.x + 15, sourceBox.y + 14);
    await page.mouse.down();
    await page.mouse.move(firstTarget.x + 20, firstTarget.y + 3, { steps: 6 });
    await page.mouse.move(firstTarget.x + 21, firstTarget.y + 3);
    const line = page.locator('[data-browser-tab-id="tab-1"] > .vertical-tree-drop-line');
    await line.waitFor();
    assert.deepEqual(await line.evaluate(el => ({ height: getComputedStyle(el).height, pointerEvents: getComputedStyle(el).pointerEvents })), { height: '4px', pointerEvents: 'none' });
    await page.mouse.up();
    await page.waitForFunction(() => window.dropRegionTest.moves.length === 1);
    assert.equal(await page.evaluate(() => window.dropRegionTest.moves[0].beforeTabId), 'tab-1');
    // 使用真实鼠标拖到目标标签行的下边缘，验证能在交界处完成放置。
    const target = page.locator('[data-drop-small-group="target"]');
    const box = await target.boundingBox();
    await source.dragTo(target, { targetPosition: { x: 3, y: box.height - 1 } });
    await page.waitForFunction(() => window.dropRegionTest.moves.length === 2);
    assert.deepEqual(await page.evaluate(() => window.dropRegionTest.moves[1]), { tabId: 'tab-0', groupId: 'a', smallGroupId: 'target', beforeTabId: null });
    // 原分组也传入排序位置，由主窗口决定是否需要调整顺序。
    await source.dragTo(page.locator('[data-drop-small-group="source"]'));
    assert.equal(await page.evaluate(() => window.dropRegionTest.moves.length), 3);
    console.log('PASS 分组全区域进入/悬停、4px 插入线、行前/末尾插入位置、原分组接受排序');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
