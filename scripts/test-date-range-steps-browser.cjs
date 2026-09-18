const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

// 通过 Vite 临时入口挂载真实框架组件，分别记录暂存和提交，验证分步选择不会提前提交。
const fixture = path.resolve(__dirname, '../apps/docs/__date_range_steps_regression.tsx');
const fixtureSource = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { DatePicker } from '../../packages/react/src/components/DatePicker';
const host = document.createElement('div');
document.body.replaceChildren(host);
const root = createRoot(host);
let version = 0;
window.mountRange = (props) => {
  window.rangeCommits = [];
  window.rangeDrafts = [];
  root.render(<DatePicker.RangePicker key={++version} {...props}
    onChange={value => window.rangeCommits.push(value)}
    onCalendarChange={value => window.rangeDrafts.push(value)} />);
};`;

(async () => {
  await fs.writeFile(fixture, fixtureSource, 'utf8');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/date-picker');
    await page.locator('.sia-picker').first().waitFor();
    await page.evaluate(() => import('/__date_range_steps_regression.tsx'));
    const panel = page.getByRole('dialog', { name: '日期范围选择面板', exact: true });
    const date = value => panel.getByRole('button', { name: value, exact: true }).first();
    const next = () => panel.getByRole('button', { name: '确定', exact: true }).click();
    const confirm = () => panel.getByRole('button', { name: '确定', exact: true });
    async function mount(props) {
      await page.evaluate(props => window.mountRange(props), props);
      await page.locator('.sia-picker__icon').click();
      await panel.waitFor();
    }
    async function committed() { return page.evaluate(() => window.rangeCommits); }

    // 桌面和窄屏均只显示一个日期及时间面板，显式关闭 needConfirm 也不能提前提交。
    for (const width of [1600, 560]) {
      await page.setViewportSize({ width, height: 1000 });
      await mount({ showTime: { showSecond: true }, needConfirm: false,
        defaultValue: ['2026-09-02 08:10:11', '2026-10-15 18:20:21'] });
      assert.equal(await panel.locator('.sia-date-panel__calendar').count(), 1);
      assert.equal(await panel.locator('.sia-date-panel__time').count(), 1);
      await date('2026-09-08').click();
      await panel.getByRole('listbox', { name: '开始时间秒', exact: true }).getByRole('option', { name: '12', exact: true }).click();
      assert.deepEqual(await committed(), []);
      await next();
      assert.equal(await panel.locator('.sia-date-panel__calendar').count(), 1);
      assert.equal(await date('2026-09-18').count(), 1);
      assert.equal(await date('2026-09-07').isDisabled(), true);
      await date('2026-09-18').click();
      await panel.getByRole('listbox', { name: '结束时间秒', exact: true }).getByRole('option', { name: '22', exact: true }).click();
      assert.deepEqual(await committed(), []);
      await page.locator('.sia-picker-range-control__field').nth(0).click();
      assert.equal(await panel.getByRole('listbox', { name: '开始时间秒', exact: true }).getByRole('option', { name: '12', exact: true }).getAttribute('aria-selected'), 'true');
      await next();
      await confirm().click();
      await panel.waitFor({ state: 'hidden' });
      assert.deepEqual(await committed(), [['2026-09-08 08:10:12', '2026-09-18 18:20:22']]);
    }

    // 点击结束输入框直接显示结束面板；切换端点保留草稿，活动底线跟随端点且关闭后消失。
    await mount({ showTime: { showSecond: true }, defaultValue: ['2026-09-02 08:00:00', '2026-10-15 18:00:00'] });
    await page.locator('.sia-picker__icon').click();
    const fields = page.locator('.sia-picker-range-control__field');
    await fields.nth(1).click();
    assert.equal(await panel.locator('[aria-label="结束日期时间"]').count(), 1);
    assert.equal(await panel.getByRole('button', { name: '下一步', exact: true }).count(), 0);
    assert.equal(await fields.nth(1).evaluate(el => getComputedStyle(el, '::after').height), '3px');
    await date('2026-10-20').click();
    await fields.nth(0).click();
    assert.equal(await panel.locator('[aria-label="开始日期时间"]').count(), 1);
    assert.equal(await fields.nth(0).evaluate(el => getComputedStyle(el, '::after').height), '3px');
    assert.equal(await fields.nth(1).evaluate(el => el.classList.contains('is-active')), false);
    await date('2026-09-08').click();
    await fields.nth(1).click();
    await confirm().click();
    assert.deepEqual(await committed(), []);
    assert.equal(await panel.locator('[aria-label="开始日期时间"]').count(), 1);
    await confirm().click();
    await panel.waitFor({ state: 'hidden' });
    assert.deepEqual(await committed(), [['2026-09-08 08:00:00', '2026-10-20 18:00:00']]);
    assert.equal(await page.locator('.sia-picker-range-control__field.is-active').count(), 0);

    // 空范围先设置结束时间也可确认进入开始端；旧开始值不会限制首次选择结束日期。
    for (const initial of [['', ''], ['2026-09-25 08:00:00', '2026-09-28 18:00:00']]) {
      await mount({ showTime: { showSecond: true }, defaultValue: initial });
      await page.locator('.sia-picker__icon').click();
      await fields.nth(1).click();
      const candidate = initial[0] ? date('2026-09-18') : panel.getByRole('button', { name: /^\d{4}-\d{2}-18$/ }).first();
      const endDay = await candidate.getAttribute('aria-label');
      await candidate.click();
      await confirm().click();
      assert.deepEqual(await committed(), []);
      assert.equal(await panel.locator('[aria-label="开始日期时间"]').count(), 1);
      const startDay = endDay.slice(0, 8) + '08';
      assert.equal(await date(endDay.slice(0, 8) + '20').isDisabled(), true);
      await date(startDay).click();
      await confirm().click();
      await panel.waitFor({ state: 'hidden' });
      assert.equal((await committed()).length, 1);
      // 重新打开后重置确认进度，不能沿用上一次的确认直接关闭。
      await fields.nth(1).click();
      await confirm().click();
      assert.equal(await panel.locator('[aria-label="开始日期时间"]').count(), 1);
      await confirm().click();
    }

    // 允许任一端为空时即时回显日期和秒；双端必填仍显示提交值；带时间未确认收起时不保存。
    for (const allowEmpty of [[true, true], [false, true], [true, false], [false, false]]) {
      await mount({ showTime: { showSecond: true }, allowEmpty, placeholderMode: 'floating',
        defaultValue: ['2026-09-02 08:00:00', '2026-09-18 18:00:00'] });
      await date('2026-09-08').click();
      await panel.getByRole('listbox', { name: '开始时间秒', exact: true }).getByRole('option', { name: '12', exact: true }).click();
      const displayed = page.locator('.sia-picker-range-control__value');
      assert.equal(await displayed.nth(0).textContent(), allowEmpty.some(Boolean) ? '2026-09-08 08:00:12' : '2026-09-02 08:00:00');
      assert.deepEqual(await committed(), []);
      await next();
      await date('2026-09-16').click();
      assert.equal(await displayed.nth(1).textContent(), allowEmpty.some(Boolean) ? '2026-09-16 18:00:00' : '2026-09-18 18:00:00');
      await page.locator('.sia-picker__icon').click();
      assert.equal(await displayed.nth(0).textContent(), '2026-09-02 08:00:00');
      assert.deepEqual(await committed(), []);
    }

    // 纯日期选中即保存单端，点击外部保留已选值，重新打开可继续设置；带时间必填时不保存未确认值。
    for (const endpoint of [0, 1]) {
      await mount({ allowEmpty: [true, true] });
      const dayButton = panel.getByRole('button', { name: /^\d{4}-\d{2}-18$/ }).first();
      const day = await dayButton.getAttribute('aria-label');
      await dayButton.click();
      assert.deepEqual(await committed(), [[day, '']]);
      await page.mouse.click(1500, 900);
      await panel.waitFor({ state: 'hidden' });
      const expected = ['', ''];
      expected[0] = day;
      assert.deepEqual(await committed(), [expected]);
      assert.equal(await fields.nth(0).locator('.sia-picker-range-control__value').textContent(), expected[0]);
      await fields.nth(endpoint).click();
      await page.mouse.click(1500, 900);
      assert.deepEqual(await committed(), [expected]);
    }
    await mount({ showTime: true, allowEmpty: [false, false] });
    await panel.getByRole('button', { name: /^\d{4}-\d{2}-18$/ }).first().click();
    await page.mouse.click(1500, 900);
    assert.deepEqual(await committed(), []);

    // 快捷范围位于日历左侧且纵向排列；不提供上一步，回填后仍等待确认。
    await page.setViewportSize({ width: 1600, height: 1000 });
    await mount({ showTime: { showSecond: true }, presets: [
      { label: '最近 7 天', value: ['2026-09-12 00:00:00', '2026-09-18 23:59:59'] },
      { label: '最近 14 天', value: ['2026-09-05 00:00:00', '2026-09-18 23:59:59'] },
    ] });
    const shortcuts = panel.locator('.sia-date-panel__presets button');
    const firstShortcut = await shortcuts.nth(0).boundingBox();
    const secondShortcut = await shortcuts.nth(1).boundingBox();
    const calendarBounds = await panel.locator('.sia-date-panel__calendar').boundingBox();
    assert(firstShortcut.x + firstShortcut.width <= calendarBounds.x);
    assert(secondShortcut.y >= firstShortcut.y + firstShortcut.height);
    assert.equal(await panel.locator('.sia-date-panel__footer').getByRole('button', { name: '最近 7 天' }).count(), 0);
    await shortcuts.nth(0).click();
    assert.deepEqual(await committed(), []);
    assert.equal(await panel.getByRole('button', { name: '上一步', exact: true }).count(), 0);
    await confirm().click();
    await panel.waitFor({ state: 'hidden' });
    assert.deepEqual(await committed(), [['2026-09-12 00:00:00', '2026-09-18 23:59:59']]);

    // 从结束端进入或处于第二步时应用快捷范围，也只需一次确认；再次手动修改则恢复分步。
    for (const entry of ['end', 'second', 'edit']) {
      await mount({ showTime: { showSecond: true }, defaultValue: ['2026-09-02 00:00:00', '2026-09-18 23:59:59'],
        presets: [{ label: '最近 7 天', value: ['2026-09-12 00:00:00', '2026-09-18 23:59:59'] }] });
      if (entry === 'end') await fields.nth(1).click();
      if (entry === 'second') await next();
      await panel.getByRole('button', { name: '最近 7 天', exact: true }).click();
      assert.deepEqual(await committed(), []);
      if (entry === 'edit') {
        await date('2026-09-13').click();
        await confirm().click();
        assert.deepEqual(await committed(), []);
      }
      await confirm().click();
      await panel.waitFor({ state: 'hidden' });
      assert.deepEqual(await committed(), [[entry === 'edit' ? '2026-09-13 00:00:00' : '2026-09-12 00:00:00', '2026-09-18 23:59:59']]);
    }

    // 开始日期可超过旧结束日期；同一天结束时刻更早时禁止提交。
    await mount({ showTime: { showSecond: true }, defaultValue: ['2026-09-02 18:00:00', '2026-09-03 08:00:00'] });
    assert.equal(await date('2026-09-20').isDisabled(), false);
    await date('2026-09-20').click();
    await next();
    await date('2026-09-20').click();
    assert.equal(await confirm().isDisabled(), true);
    await panel.getByRole('listbox', { name: '结束时间小时', exact: true }).getByRole('option', { name: '19', exact: true }).click();
    await confirm().click();
    assert.deepEqual(await committed(), [['2026-09-20 18:00:00', '2026-09-20 19:00:00']]);

    // 日期跨度限制在结束步骤生效，锁定结束端点时可直接确认可编辑的开始端点。
    await mount({ showTime: true, maxRangeDays: 7, defaultValue: ['2026-09-02 00:00', '2026-09-03 00:00'] });
    await date('2026-09-10').click();
    await next();
    assert.equal(await date('2026-09-16').isDisabled(), false);
    assert.equal(await date('2026-09-17').isDisabled(), true);
    await mount({ showTime: true, endpointDisabled: [false, true], defaultValue: ['2026-09-02 00:00', '2026-09-18 00:00'] });
    await date('2026-09-08').click();
    await confirm().click();
    assert.deepEqual(await committed(), [['2026-09-08 00:00', '2026-09-18 00:00']]);

    // 纯日期范围仍可在同一个月份连续点击两次并自动提交。
    await page.setViewportSize({ width: 1600, height: 1000 });
    await mount({ defaultValue: ['2026-09-02', '2026-10-15'] });
    await date('2026-09-08').click();
    await date('2026-09-18').click();
    await panel.waitFor({ state: 'hidden' });
    assert.deepEqual(await committed(), [['2026-09-08', '2026-09-18']]);
    console.log('PASS date range: single-panel steps, seconds, explicit confirmation, back navigation, same-month selection, time ordering, range limits, locked endpoint, and date-only selection.');
  } finally {
    await browser.close();
    await fs.unlink(fixture);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
