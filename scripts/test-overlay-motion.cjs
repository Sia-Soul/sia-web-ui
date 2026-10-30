// 真实浏览器验证外壳先出现、正文延后、开合中断和键盘焦点，记录帧间隔但不硬编码设备帧率。
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const requireUi = createRequire(path.resolve('packages/react/package.json'));
const { buildSync } = createRequire(requireUi.resolve('tsup'))('esbuild');
const modules = path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-motion-'));
  buildSync({ entryPoints: ['scripts/fixtures/overlay-motion.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js' || req.url === '/fixture.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(fs.readFileSync(path.join(directory, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    // 在点击前开始采样，以正文提交时间对照外壳已进入动画的时间。
    await page.evaluate(() => {
      window.motionSamples = [];
      const sample = time => {
        const panel = document.querySelector('.sia-drawer, .sia-modal');
        if (panel?.getAnimations().some(animation => animation.playState === 'running')) window.motionSamples.push(time);
        window.motionRaf = requestAnimationFrame(sample);
      };
      window.motionRaf = requestAnimationFrame(sample);
    });
    await page.getByText('打开', { exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByLabel('延后输入').count(), 0, '外壳先呈现，重正文应在入场完成后挂载');
    assert.equal(await page.locator('.sia-skeleton__block').count(), 12, '默认骨架两列六行，实际正文尚未挂载');
    assert.equal(await page.locator('.sia-drawer__body').evaluate(node => getComputedStyle(node).overflowY), 'hidden', '骨架阶段不可滚动');
    assert.equal(await page.locator('.sia-drawer__body[data-sia-floating-scrollbar]').count(), 0, '骨架不接管浮动滚动条');
    await page.getByLabel('延后输入').waitFor();
    assert.equal(await page.locator('.sia-skeleton').count(), 0, '正文就绪后移除骨架');
    assert.equal(await page.locator('.sia-drawer__body').evaluate(node => getComputedStyle(node).overflowY), 'auto', '正文恢复滚动');
    await page.waitForFunction(() => window.motionEvents.includes(true));
    const drawerHeight = await page.locator('.sia-drawer').evaluate(node => node.offsetHeight);
    const controlSize = await page.locator('.sia-drawer__body .sia-input-control').evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight }));
    await page.keyboard.press('Escape');
    await page.locator('.sia-drawer').evaluate(node => node.getAnimations().forEach(animation => animation.pause()));
    assert.equal(await page.locator('.sia-drawer__body .sia-skeleton').count(), 1, '关闭时骨架接替正文');
    assert.equal(await page.getByLabel('延后输入').count(), 0, '真实正文已卸载');
    assert.equal(await page.locator('.sia-drawer__body .sia-skeleton__block').count(), 1, '一个复合输入框只生成一块骨架，不重复计算清空按钮和计数');
    const blockSize = await page.locator('.sia-drawer__body .sia-skeleton__block').evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight }));
    assert.deepEqual(blockSize, controlSize, '关闭骨架保持输入框原尺寸');
    assert.equal(await page.locator('.sia-drawer').evaluate(node => node.offsetHeight), drawerHeight);
    assert.equal(await page.locator('.sia-drawer__body').evaluate(node => getComputedStyle(node).overflowY), 'hidden');
    await page.locator('.sia-drawer').evaluate(node => node.getAnimations().forEach(animation => animation.play()));
    assert.equal(await page.getByRole('dialog').count(), 1, '关闭保留退场过程');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => window.motionEvents), [true, false]);
    const timing = await page.evaluate(() => ({ firstMotionFrame: window.motionSamples[0], bodyMounted: window.bodyMountedAt, frames: window.motionSamples.length }));
    assert.ok(timing.bodyMounted > timing.firstMotionFrame + 200, '先绘制动画帧，再挂载重正文');
    console.log('TIMING', JSON.stringify(timing));
    // 快速关闭未完成的入场，再打开；旧关闭回调不能卸载新实例。
    await page.getByText('打开', { exact: true }).click();
    // 反播只耗时已走过的路程；先推进到中段，确保 45ms 后仍在退场。
    await page.locator('.sia-drawer').evaluate(node => node.getAnimations().forEach(animation => { animation.currentTime = 160; }));
    await page.evaluate(() => window.setMotionOpen(false));
    await page.waitForTimeout(45);
    await page.evaluate(() => window.setMotionOpen(true));
    await page.getByLabel('延后输入').waitFor();
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.deepEqual(await page.evaluate(() => window.motionEvents), [true]);
    // 容器尺寸不变时子组件新增字段，也应刷新布局快照，隐藏字段不生成占位。
    await page.evaluate(() => window.setExtraFields(true));
    await page.getByLabel('新增字段 A').waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => window.setMotionOpen(false));
    await page.locator('.sia-drawer').evaluate(node => node.getAnimations().forEach(animation => animation.pause()));
    assert.equal(await page.locator('.sia-drawer__body .sia-skeleton__block').count(), 3);
    await page.locator('.sia-drawer').evaluate(node => node.getAnimations().forEach(animation => animation.play()));
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    for (const placement of ['left', 'top', 'bottom']) {
      await page.evaluate(placement => window.setMotionPlacement(placement), placement);
      await page.getByText('打开', { exact: true }).click();
      await page.getByLabel('延后输入').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    await page.evaluate(() => window.setMotionKind('modal'));
    await page.getByText('打开', { exact: true }).click();
    assert.equal(await page.locator('.sia-modal__body').evaluate(node => getComputedStyle(node).overflowY), 'hidden', '固定高度 Modal 骨架不显示滚动条');
    assert.equal(await page.locator('.sia-modal__body[data-sia-floating-scrollbar]').count(), 0);
    await page.getByLabel('延后输入').waitFor();
    assert.equal(await page.locator('.sia-modal__body').evaluate(node => getComputedStyle(node).overflowY), 'auto');
    await page.locator('.sia-modal__body').evaluate(node => { node.scrollTop = 150; });
    assert.ok(await page.locator('.sia-modal__body').evaluate(node => node.scrollTop > 0), '真实长内容正常滚动');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '延后输入');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    // 视频中的 Select 弹框会随 open 清空 children，骨架须保持自然高度直到退出完成。
    await page.getByRole('combobox', { name: '自动弹框回归' }).click();
    await page.getByText('候选 16', { exact: true }).waitFor();
    const selectHeight = await page.locator('.sia-modal').evaluate(node => node.offsetHeight);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('.sia-modal').evaluate(node => node.getAnimations().forEach(animation => animation.pause()));
    assert.equal(await page.locator('.sia-modal__body .sia-skeleton').count(), 1);
    assert.equal(await page.locator('.sia-modal').evaluate(node => node.offsetHeight), selectHeight, '自然高度弹框退场不能塌缩');
    assert.equal(await page.locator('.sia-modal__body').evaluate(node => getComputedStyle(node).overflowY), 'hidden');
    await page.locator('.sia-modal').evaluate(node => node.getAnimations().forEach(animation => animation.play()));
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    // 选择面板与菜单保留退出节点，且最终位置不受缩放动画影响。
    await page.getByRole('combobox').first().click();
    await page.locator('.sia-select__dropdown').waitFor();
    // 保存中段画面供视觉检查，动画不能覆盖组件圆角或裁掉实际内容。
    await page.locator('.sia-select__dropdown').evaluate(node => { const a=node.getAnimations()[0];a.pause();a.currentTime=120; });
    await page.screenshot({path:'logs/popup-fluid-midpoint.png'});
    const popupTrajectory = await page.locator('.sia-select__dropdown').evaluate(node => {
      const animation = node.getAnimations()[0]; animation.pause();
      const values = [0, .15, .3, .5, .75, 1].map(t => {
        animation.currentTime = Number(animation.effect.getTiming().duration) * t;
        const matrix = new DOMMatrix(getComputedStyle(node).transform);
        return { scaleX: matrix.a, scaleY: matrix.d, clipPath: getComputedStyle(node).clipPath, left: node.style.left, top: node.style.top };
      });
      const duration = animation.effect.getTiming().duration;
      animation.finish(); return { values, duration };
    });
    assert.equal(popupTrajectory.duration, 260);
    assert.ok(popupTrajectory.values[0].scaleX < 1 && popupTrajectory.values[5].scaleX === 1 && popupTrajectory.values[5].scaleY === 1, '缩放入场后回到原尺寸');
    assert.ok(popupTrajectory.values.some(value=>value.scaleX>1.02 && value.scaleY>1.02),'展开恢复果冻弹大');
    assert.ok(popupTrajectory.values.every(value => value.clipPath === 'none'), '开合不裁剪组件原有外观');
    assert.ok(popupTrajectory.values.every(value => value.left === popupTrajectory.values[0].left && value.top === popupTrajectory.values[0].top), '缩放不引起定位漂移');
    // 完整开合时长从真正展开完成后验证，避免测量到中途折返的剩余路程。
    await page.waitForFunction(() => document.querySelector('.sia-select__dropdown')?.getAnimations().length === 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sia-select__dropdown').count(), 1);
    await page.locator('.sia-select__dropdown').waitFor({ state: 'detached' });
    // 运行中反向以当前变换为起点，不能重新跳回 .82 倍。
    await page.getByRole('combobox').first().click();
    await page.locator('.sia-select__dropdown').waitFor();
    const reversed = await page.locator('.sia-select__dropdown').evaluate(async node => {
      const entering = node.getAnimations()[0]; entering.pause(); entering.currentTime = 100;
      const before = getComputedStyle(node).transform;
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(requestAnimationFrame);
      const exiting = node.getAnimations()[0]; exiting.pause(); exiting.currentTime = 0;
      const after = getComputedStyle(node).transform;
      exiting.play(); return { before, after, duration: exiting.effect.getTiming().duration };
    });
    assert.equal(reversed.before, reversed.after, '快速关闭从当前变换继续');
    assert.ok(reversed.duration > 0 && reversed.duration <= 140);
    await page.locator('.sia-select__dropdown').waitFor({ state: 'detached' });
    // 日历体积更大，检查稳定文字和展开后的完整显示。
    await page.getByText('液体日期',{exact:true}).click();
    await page.locator('.sia-date-panel').evaluate(node=>{const a=node.getAnimations()[0];a.pause();a.currentTime=120;});
    await page.screenshot({path:'logs/date-popup-fluid-midpoint.png'});
    await page.locator('.sia-date-panel').evaluate(node=>node.getAnimations()[0].finish());
    await page.waitForFunction(()=>document.querySelector('.sia-date-panel')?.getAnimations().length===0);
    assert.equal(await page.locator('.sia-date-panel').evaluate(node=>getComputedStyle(node).clipPath),'none','展开完成后释放裁剪，阴影和日历不残留缺口');
    await page.keyboard.press('Escape');
    await page.locator('.sia-date-panel').waitFor({state:'detached'});
    await page.getByText('菜单', { exact: true }).click();
    await page.getByText('菜单项', { exact: true }).click();
    await page.locator('.sia-dropdown__popup').waitFor({ state: 'detached' });
    // 多级菜单同样走 PopupPortal；右键关闭必须等真实动画，不能由旧的 160ms 计时切走锚点。
    await page.getByText('菜单', { exact: true }).click();
    // 待父菜单完成展开后再验证侧向悬停入口，避免测试鼠标命中移动中的项。
    await page.waitForFunction(() => document.querySelector('.sia-dropdown__popup')?.getAnimations().length === 0);
    await page.getByText('更多项目', { exact: true }).hover();
    await page.getByText('子菜单项目', { exact: true }).waitFor();
    assert.equal(await page.locator('.sia-menu__popup').evaluate(node => node.getAttribute('data-placement')?.split('-')[0]), 'right');
    await page.getByText('子菜单项目', { exact: true }).click();
    await page.locator('.sia-dropdown__popup').waitFor({ state: 'detached' });
    await page.getByText('右键菜单', { exact: true }).click({ button: 'right' });
    await page.getByText('右键选项', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.sia-dropdown__popup')?.getAnimations().length === 0);
    await page.keyboard.press('Escape');
    const contextPosition = await page.locator('.sia-dropdown__popup').evaluate(node => { node.getAnimations().forEach(a => a.pause()); return [node.style.left, node.style.top]; });
    await page.waitForTimeout(200);
    assert.deepEqual(await page.locator('.sia-dropdown__popup').evaluate(node => [node.style.left, node.style.top]), contextPosition);
    await page.locator('.sia-dropdown__popup').evaluate(node => node.getAnimations().forEach(a => a.finish()));
    await page.locator('.sia-dropdown__popup').waitFor({ state: 'detached' });
    await page.getByText('提示', { exact: true }).click();
    await page.getByRole('tooltip').waitFor();
    assert.ok(await page.locator('.sia-floating__overlay').evaluate(node => node.getAnimations().some(animation => animation.effect.getTiming().duration === 280)));
    await page.getByText('提示', { exact: true }).click();
    await page.locator('.sia-floating__overlay').waitFor({ state: 'detached' });
    await page.evaluate(() => { window.testMessage = window.motionMessage.success('动效消息', 0); });
    await page.getByText('动效消息').waitFor();
    // 暂停采样实际动画：正文矩阵始终为单位缩放，弹性形变仅出现在背景伪元素。
    const messageSamples = await page.locator('.sia-message').evaluate(node => {
      const animations = node.getAnimations({ subtree: true });
      animations.forEach(animation => animation.pause());
      const samples = [.1, .25, .4, .6, .8, .95].map(progress => {
        animations.forEach(animation => { animation.currentTime = 280 * progress; });
        const body = new DOMMatrix(getComputedStyle(node).transform);
        const background = new DOMMatrix(getComputedStyle(node, '::before').transform);
        return { textX: body.a, textY: body.d, backgroundX: background.a };
      });
      const durations = animations.map(animation => animation.effect.getTiming().duration);
      animations.forEach(animation => animation.play());
      return { samples, durations };
    });
    assert.equal(messageSamples.durations.length, 2, '背景与内容使用独立动画');
    assert.ok(messageSamples.durations.every(duration => duration === 280));
    assert.ok(messageSamples.samples.every(sample => sample.textX === 1 && sample.textY === 1), '动画全程不缩放文字');
    assert.ok(messageSamples.samples.some(sample => sample.backgroundX > 1.04), '保留背景 Q 弹过冲');
    await page.evaluate(() => window.testMessage.close());
    assert.ok(await page.locator('.sia-message').evaluate(node => node.getAnimations().every(animation => animation.effect.getTiming().duration === 280)), '消息开合时长相同');
    assert.equal(await page.getByText('动效消息').count(), 1);
    await page.getByText('动效消息').waitFor({ state: 'detached' });
    await page.evaluate(() => { window.testNotice = window.motionNotification.success({ message: '通知动效', duration: 0 }); });
    await page.getByText('通知动效').waitFor();
    await page.waitForFunction(() => document.querySelector('.sia-notification__notice')?.getAnimations().length === 0);
    await page.evaluate(() => window.testNotice.close());
    assert.equal(await page.getByText('通知动效').count(), 1);
    await page.getByText('通知动效').waitFor({ state: 'detached' });
    // 默认立即挂载；关闭占位独立于 deferContent，并复用自定义 fallback。
    for (const kind of ['motionModal', 'motionDrawer']) {
      await page.evaluate(kind => { window.immediateHandle = window[kind].open({ title: '默认挂载', children: '默认正文', loadingFallback: '关闭占位' }); }, kind);
      await page.getByText('默认正文', { exact: true }).waitFor();
      const panel = page.locator('.sia-modal, .sia-drawer');
      const expectedDuration = kind === 'motionModal' ? 240 : 320;
      assert.ok(await panel.evaluate((node, duration) => node.getAnimations().some(animation => animation.effect.getTiming().duration === duration), expectedDuration));
      assert.ok(await panel.evaluate(node => node.getAnimations().some(animation => animation.playState === 'running')), '入场尚未结束时默认正文已挂载');
      // 明确推进到中段，退场骨架应覆盖已走过的半段轨迹。
      await panel.evaluate((node, duration) => node.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = duration / 2; }), expectedDuration);
      await page.evaluate(() => window.immediateHandle.destroy());
      await panel.evaluate(node => node.getAnimations().forEach(animation => animation.pause()));
      assert.ok(await panel.evaluate((node, duration) => node.getAnimations().every(animation => animation.effect.getTiming().duration === duration), kind === 'motionModal' ? 160 : 180), '容器关闭更快且保留退场节点');
      assert.equal(await page.getByText('关闭占位', { exact: true }).count(), 1);
      await panel.evaluate(node => node.getAnimations().forEach(animation => animation.play()));
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    // 静态 API 立即关闭仍释放挂载点，减少动态效果不等待固定计时器。
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      window.motionModal.open({ title: '立即关闭' }).destroy();
      window.motionDrawer.open({ title: '立即关闭' }).destroy();
      window.motionMessage.success('立即关闭消息', 0).close();
    });
    await page.waitForFunction(() => !document.querySelector('.sia-modal-api-host, .sia-drawer-api-host, .sia-message'));
    await page.getByText('打开', { exact: true }).click();
    await page.getByLabel('延后输入').waitFor();
    assert.equal(await page.locator('.sia-modal').evaluate(node => node.getAnimations().length), 0);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    console.log('PASS 四向抽屉、关闭骨架与尺寸保持、Select 条件正文退场、重正文延后、快速反向、Modal 聚焦、静态 API 和减少动态效果。');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('sia-motion-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
