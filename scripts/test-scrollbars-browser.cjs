const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3], ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/select');
    await page.getByRole('combobox', { name: '选择项目成员' }).click();
    const list = page.getByRole('listbox');
    await list.waitFor();
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').hasAttribute('data-sia-floating-scrollbar'));
    const native = await list.evaluate(el => ({
      overflow: el.scrollHeight > el.clientHeight,
      width: getComputedStyle(el).scrollbarWidth,
      display: getComputedStyle(el, '::-webkit-scrollbar').display,
    }));
    assert(native.overflow, 'The 1000-option list must overflow');
    assert.equal(native.width, 'none');
    assert.equal(native.display, 'none');
    await list.hover();
    await page.mouse.wheel(0, 4000);
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').scrollTop > 1000);
    await page.waitForTimeout(200);
    const selectThumb = await page.evaluate(() => {
      const rect = document.querySelector('[role="listbox"]').getBoundingClientRect();
      const track = [...document.querySelectorAll('.sia-floating-scrollbar--vertical')]
        .find(el => !el.hidden && Math.abs(parseFloat(el.style.left) - (rect.right - 8)) < 1);
      if (!track || getComputedStyle(track).opacity !== '1') throw new Error('Select floating scrollbar must be visible');
      return track.firstElementChild.getBoundingClientRect().toJSON();
    });
    const beforeDrag = await list.evaluate(el => el.scrollTop);
    await page.mouse.move(selectThumb.x + 3, selectThumb.y + selectThumb.height / 2);
    await page.mouse.down();
    await page.mouse.move(selectThumb.x + 3, selectThumb.y + selectThumb.height / 2 + 35, { steps: 6 });
    await page.mouse.up();
    assert(await list.isVisible(), 'Dragging a popup scrollbar must not close the Select');
    assert(await list.evaluate(el => el.scrollTop) > beforeDrag, 'Select thumb must scroll the virtual list');
    await page.screenshot({ path: 'apps/docs/scrollbar-select-floating-verified.png' });

    // Check all shared scrolling styles without depending on demo content lengths.
    const classes = ['sia-select__list', 'sia-tree-select__tree', 'sia-cascader__menu',
      'sia-cascader__results', 'sia-drawer__body', 'sia-splitter__panel',
      'sia-table-selection-panel__body', 'sia-rich-text-editor__content',
      'sia-date-panel', 'sia-chart-data-view__body'];
    const hidden = await page.evaluate(classes => classes.filter(className => {
      const el = document.createElement('div');
      el.className = className;
      el.style.cssText = 'height:80px;width:120px;overflow:auto';
      el.innerHTML = '<div style="height:500px;width:500px"></div>';
      document.body.append(el);
      const hidden = getComputedStyle(el).scrollbarWidth === 'none'
        || getComputedStyle(el, '::-webkit-scrollbar').display === 'none';
      el.remove();
      return hidden;
    }), classes);
    assert.deepEqual(hidden, []);

    await page.goto('http://127.0.0.1:4173/components/floating-scrollbar');
    const toggle = page.getByRole('checkbox', { name: '启用全局浮动滚动条' });
    await toggle.waitFor();
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'scrollbar-regression';
      fixture.style.cssText = 'position:fixed;top:100px;left:500px;width:200px;height:150px;overflow:auto;z-index:100;background:white';
      fixture.innerHTML = '<div style="width:800px;height:800px">Scroll fixture</div>';
      document.body.append(fixture);
    });
    const fixture = page.locator('#scrollbar-regression');
    await page.waitForFunction(() => document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    await fixture.hover();
    await page.waitForFunction(() => [...document.querySelectorAll('.sia-floating-scrollbar--vertical')]
      .some(el => !el.hidden && el.style.left === '692px' && getComputedStyle(el).opacity === '1'));
    const matching = await page.evaluate(() => [...document.querySelectorAll('.sia-floating-scrollbar--vertical')]
      .find(el => !el.hidden && el.style.left === '692px').getBoundingClientRect().toJSON());
    await page.mouse.click(matching.x + 4, matching.y + matching.height - 5);
    assert(await fixture.evaluate(el => el.scrollTop > 0), 'Track click must scroll');
    const thumb = await page.evaluate(() => [...document.querySelectorAll('.sia-floating-scrollbar--horizontal')]
      .find(el => !el.hidden && el.style.left === '500px')
      .firstElementChild.getBoundingClientRect().toJSON());
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + 3);
    await page.mouse.down();
    await page.mouse.move(thumb.x + thumb.width / 2 + 60, thumb.y + 3, { steps: 6 });
    await page.mouse.up();
    assert(await fixture.evaluate(el => el.scrollLeft > 0), 'Horizontal thumb drag must scroll');
    await page.getByText('启用全局浮动滚动条', { exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    assert.notEqual(await fixture.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
    await page.getByText('启用全局浮动滚动条', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    await fixture.evaluate(el => el.setAttribute('data-sia-native-scrollbar', ''));
    await page.waitForFunction(() => !document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    assert.notEqual(await fixture.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
    assert.equal(await page.locator('.overlay-scroll-area__viewport[data-sia-floating-scrollbar]').count(), 0);
    // Overflow created only by viewport resize must also be discovered.
    await fixture.evaluate(el => {
      el.removeAttribute('data-sia-native-scrollbar');
      el.style.width = '70vw';
      el.style.height = '850px';
    });
    await page.waitForFunction(() => !document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.waitForFunction(() => document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    await page.getByText('启用全局浮动滚动条', { exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    await page.evaluate(() => {
      history.pushState({}, '', '/components/select');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(() => document.querySelector('#scrollbar-regression').hasAttribute('data-sia-floating-scrollbar'));
    assert.equal(await page.locator('.sia-floating-scrollbar-layer').count(), 1);
    console.log('PASS: virtual Select floating thumb drag without popup dismissal; 10 native fallback styles; track click and horizontal drag; disable/re-enable; native opt-out; sidebar exclusion; resize discovery; route restoration with one provider.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
