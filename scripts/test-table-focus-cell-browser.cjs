// 验证公开定位 API 的滚动、选中、焦点及一次性动效，不修改业务页面或服务端数据。
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/Table.tsx');
      const host = document.createElement('div'); document.body.replaceChildren(host);
      window.cellRoot = createRoot(host); window.cellTable = React.createRef();
      window.mountCells = (mode = 'dom', reverse = false, tall = false) => {
        const data = Array.from({ length: 500 }, (_, id) => ({ id }));
        if (reverse) data.reverse();
        window.cellRoot.render(React.createElement(Table, {
          ref: window.cellTable, rowKey: 'id', maxBodyHeight: 230, renderMode: mode, size: tall ? 'small' : 'medium',
          dataSource: data, columns: Array.from({ length: 12 }, (_, index) => ({
            key: `c${index}`, title: `字段${index}`, width: 180, invalid: index === 8,
            fixed: index === 0 ? 'left' : index === 11 ? 'right' : undefined,
            render: (_, row) => tall ? React.createElement('span', {style:{display:'block',height:30}}, `${row.id}-${index}`) : `${row.id}-${index}`,
          })),
        }));
      };
    });
    const mount = async (...args) => {
      await page.evaluate(args => window.mountCells(...args), args);
      await page.waitForFunction(() => window.cellTable.current?.getRows().length === 500);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    };
    const focus = (id, column, options) => page.evaluate(async ({ id, column, options }) => window.cellTable.current.focusCell(id, column, options), { id, column, options });
    const cell = (id, column) => page.locator(`tr[data-row-key="${id}"] td[data-column-key="${column}"]`);
    for (const mode of ['dom', 'canvas']) {
      await mount(mode);
      for (const [id, column] of [[499, 'c8'], [0, 'c1'], [250, 'c0'], [250, 'c11']]) {
        assert.equal(await focus(id, column), true);
        assert.equal(await cell(id, column).evaluate(el => el === document.activeElement), true);
        assert.equal(await page.locator('body > .sia-table__cell-focus-glow').count(), 1);
        const range = await page.evaluate(() => window.cellTable.current.getPluginApi('cellSelection').getRange());
        assert.deepEqual(range.anchor, { rowKey: id, columnKey: column });
        const bounds = await cell(id, column).evaluate(el => {
          const view = el.closest('.sia-table__viewport'), v = view.getBoundingClientRect(), c = el.getBoundingClientRect();
          const head = view.querySelector('thead').offsetHeight;
          const fixed = el.classList.contains('sia-table__cell--fixed');
          return { ok: c.top >= v.top + head - 1 && c.bottom <= v.top + view.clientHeight + 1 && c.left >= v.left + (fixed ? 0 : 180) - 1 && c.right <= v.left + view.clientWidth - (fixed ? 0 : 180) + 1 };
        });
        assert.equal(bounds.ok, true, `${mode} ${id} ${column} 位于可见区`);
      }
      await page.waitForFunction(() => !document.querySelector('.sia-table__cell-focus-glow'));
      assert.equal(await focus(250, 'c8', { highlight: false }), true);
      assert.equal(await page.locator('.sia-table__cell-focus-glow').count(), 0);
      assert.equal(await cell(250, 'c8').getAttribute('aria-invalid'), 'true');
      assert.equal(await focus('missing', 'c8'), false);
      assert.equal(await focus(0, 'missing'), false);
      console.log(`PASS ${mode}: 500行离屏、横向、左右固定列、焦点选区、渐隐移除、保留校验、无效键`);
    }
    await mount('dom', true);
    // 观察浮层首次插入的瞬间，确认先定位可见，再创建动效，不用截图推测顺序。
    await page.evaluate(() => {
      window.orbitObservations = [];
      new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof SVGElement) || !node.classList.contains('sia-table__cell-focus-glow')) return;
        const cell = document.activeElement, rect = cell.getBoundingClientRect(), view = cell.closest('.sia-table__viewport').getBoundingClientRect();
        window.orbitObservations.push(rect.top >= view.top && rect.bottom <= view.bottom + 1 && rect.left >= view.left && rect.right <= view.right + 1);
      }))).observe(document.body, { childList: true });
    });
    assert.equal(await focus(0, 'c8'), true);
    assert.equal(await page.evaluate(() => window.orbitObservations.every(Boolean) && window.orbitObservations.length > 0), true);
    // 自然播放时长度持续增长且尾端不动；端点断言不能替代中间过程检查。
    const naturalOrbit = await page.locator('.sia-table__cell-focus-glow path').first().evaluate(async path => {
      const before = parseFloat(getComputedStyle(path).strokeDasharray);
      const tailBefore = getComputedStyle(path).strokeDashoffset;
      await new Promise(resolve => setTimeout(resolve, 80));
      return {before, after: parseFloat(getComputedStyle(path).strokeDasharray),
        tailBefore, tailAfter: getComputedStyle(path).strokeDashoffset};
    });
    assert.ok(naturalOrbit.after > naturalOrbit.before, JSON.stringify(naturalOrbit));
    assert.equal(naturalOrbit.tailBefore, '0px'); assert.equal(naturalOrbit.tailAfter, '0px');
    const orbit = await page.locator('.sia-table__cell-focus-glow').evaluate(el => ({
      parent: el.parentElement.tagName, z: getComputedStyle(el).zIndex, pointer: getComputedStyle(el).pointerEvents,
      fill: getComputedStyle(el).fill,
      paths: Array.from(el.querySelectorAll('path')).map(path => {
        // 端点和中点一起验证蛇身连续增长、最终填满一圈，再恢复自然播放。
        const animation = path.getAnimations()[0], time = animation.currentTime;
        animation.pause(); animation.currentTime = 0;
        const start = getComputedStyle(path).strokeDasharray;
        animation.currentTime = 150;
        const middle = getComputedStyle(path).strokeDasharray;
        animation.currentTime = 300;
        const end = getComputedStyle(path).strokeDasharray;
        animation.currentTime = 450;
        const shrinking = { length: parseFloat(getComputedStyle(path).strokeDasharray), tail: parseFloat(getComputedStyle(path).strokeDashoffset) };
        animation.currentTime = 600;
        const closed = { length: parseFloat(getComputedStyle(path).strokeDasharray), tail: parseFloat(getComputedStyle(path).strokeDashoffset) };
        animation.currentTime = time; animation.play();
        return {color:getComputedStyle(path).stroke, width:getComputedStyle(path).strokeWidth,
          filter:getComputedStyle(path).filter, length:path.getAttribute('pathLength'),
          timing:animation.effect.getTiming(), start, middle, end, shrinking, closed};
      }),
    }));
    assert.equal(orbit.parent, 'BODY'); assert.equal(orbit.z, '2147483647'); assert.equal(orbit.pointer, 'none'); assert.equal(orbit.fill, 'none');
    for (const path of orbit.paths) {
      assert.equal(path.color, 'rgb(255, 48, 59)'); assert.equal(path.length, '100');
      // 增长与收拢各 300ms，两个中点走过的路径长度相等，仍只执行一次。
      assert.equal(path.timing.iterations, 1); assert.equal(path.timing.duration, 600);
      assert.equal(path.width, '4px'); assert.match(path.filter, /drop-shadow/);
      assert.equal(parseFloat(path.start), 0); assert.equal(parseFloat(path.middle), 50);
      assert.equal(parseFloat(path.end), 100);
      assert.equal(path.shrinking.length, 50); assert.equal(path.shrinking.tail, -50);
      assert.equal(path.closed.length, 0); assert.equal(path.closed.tail, -100);
    }
    console.log('PASS 先可见再播放、body最高层、4px柔光、增长一圈后从尾部收拢到头部');
    // 自然采样收缩段，头部位置不变且尾部前进，不以端点跳变冒充动画。
    await focus(0, 'c8', { color: '#fa8c16', speed: 0.5, lineWidth: 6 });
    const shrinking = await page.locator('.sia-table__cell-focus-glow path').evaluate(async path => {
      await new Promise(resolve => setTimeout(resolve, 800));
      const sample = () => { const s = getComputedStyle(path); return { length: parseFloat(s.strokeDasharray), tail: parseFloat(s.strokeDashoffset), color:s.stroke, width:s.strokeWidth, filter:s.filter, duration:s.animationDuration }; };
      const before = sample(); await new Promise(resolve => setTimeout(resolve, 80));
      return {before, after:sample()};
    });
    assert.equal(shrinking.before.color, 'rgb(250, 140, 22)'); assert.equal(shrinking.before.width, '6px');
    assert.equal(shrinking.before.duration, '1.2s'); assert.match(shrinking.before.filter, /drop-shadow/);
    assert.ok(shrinking.after.length < shrinking.before.length && shrinking.after.tail < shrinking.before.tail);
    assert.ok(Math.abs(shrinking.after.length - shrinking.after.tail - 100) < 0.01);
    await page.waitForFunction(() => !document.querySelector('.sia-table__cell-focus-glow'));
    // 缺省、非法与极端参数均有确定回退；关闭动效仍只执行定位。
    for (const [options, duration, width, color] of [
      [{color:'invalid-color',speed:0,lineWidth:-1}, '0.6s','4px','rgb(255, 48, 59)'],
      [{speed:Infinity,lineWidth:NaN}, '0.6s','4px','rgb(255, 48, 59)'],
      [{speed:0.01,lineWidth:100}, '6s','12px','rgb(255, 48, 59)'],
      [{speed:2,lineWidth:2}, '0.3s','2px','rgb(255, 48, 59)'],
    ]) {
      await focus(0, 'c8', options);
      const style = await page.locator('.sia-table__cell-focus-glow path').evaluate(path => { const s=getComputedStyle(path); return {duration:s.animationDuration,width:s.strokeWidth,color:s.stroke}; });
      assert.deepEqual(style, {duration,width,color});
    }
    await focus(0, 'c8', {highlight:false,color:'#fa8c16',speed:2,lineWidth:6});
    assert.equal(await page.locator('.sia-table__cell-focus-glow').count(), 0);
    console.log('PASS 橙色与柔光、速度倍率、线宽、自然收缩、非法回退及关闭动效');
    // 用另一个高层浮块遮住单元格，验证真实层叠结果；命中测试后立即恢复鼠标穿透。
    await focus(100, 'c8');
    assert.equal(await page.evaluate(() => {
      const glow = document.querySelector('.sia-table__cell-focus-glow'), rect = glow.getBoundingClientRect();
      const blocker = document.createElement('div');
      Object.assign(blocker.style, {position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,zIndex:'2147483646',background:'white'});
      document.body.appendChild(blocker);
      glow.style.pointerEvents = 'all';
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const above = top === glow || glow.contains(top);
      glow.style.removeProperty('pointer-events'); blocker.remove();
      return above && getComputedStyle(glow).pointerEvents === 'none';
    }), true);
    console.log('PASS 实际命中层叠高于其它浮层，验证后仍允许鼠标穿透');
    // 最终截图采用商品导入计划使用的橙色公开配置。
    const racing = await page.evaluate(() => Promise.all([window.cellTable.current.focusCell(499, 'c1'), window.cellTable.current.focusCell(100, 'c8', {color:'#fa8c16',speed:1,lineWidth:4})]));
    assert.deepEqual(racing, [false, true]);
    assert.equal(await cell(100, 'c8').evaluate(el => el === document.activeElement), true);
    fs.mkdirSync('logs/table-focus-cell', { recursive: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'logs/table-focus-cell/focus.png' });
    await page.waitForFunction(() => !document.querySelector('.sia-table__cell-focus-glow'));
    await page.screenshot({ path: 'logs/table-focus-cell/after-fade.png' });
    // 流光进行中把目标滚出可视区，覆盖层不能停在旧位置或覆盖其它行。
    await focus(100, 'c8');
    await page.locator('.sia-table__viewport').evaluate(el => {el.scrollTop=0;});
    await page.waitForFunction(() => !document.querySelector('.sia-table__cell-focus-glow'));
    console.log('PASS 目标滚出视口时立即移除顶层流光');
    await mount('dom', false, true);
    assert.equal(await focus(499, 'c8'), true);
    assert.equal(await cell(499, 'c8').evaluate(el => el.getBoundingClientRect().bottom <= el.closest('.sia-table__viewport').getBoundingClientRect().bottom + 1), true);
    console.log('PASS 内容撑高后按实际行高校正末行定位');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // 减少动态效果忽略速度，但颜色和线宽仍生效。
    await focus(0, 'c8', {color:'#fa8c16',speed:0.1,lineWidth:6});
    assert.equal(await page.locator('.sia-table__cell-focus-glow').evaluate(el => getComputedStyle(el).animationDuration), '0.2s');
    assert.equal(await page.locator('.sia-table__cell-focus-glow path').evaluate(el => getComputedStyle(el).stroke), 'rgb(250, 140, 22)');
    await page.waitForFunction(() => !document.querySelector('.sia-table__cell-focus-glow'));
    await page.locator('.sia-table').evaluate(el => { el.style.display = 'none'; });
    assert.equal(await focus(0, 'c8'), false);
    console.log('PASS 排序、连续定位仅最后生效、减少动态效果、隐藏表格');
    await page.locator('.sia-table').evaluate(el => {el.style.display='';});
    await focus(0, 'c8');
    await page.evaluate(() => window.cellRoot.unmount());
    assert.equal(await page.locator('.sia-table__cell-focus-glow').count(), 0);
    console.log('PASS 表格卸载清理顶层流光');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
