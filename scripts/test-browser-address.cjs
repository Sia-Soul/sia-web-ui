/** 使用独立浏览器和虚构历史记录验证真实地址栏，不读取用户浏览数据。 */
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.addressTest = { navigations: [] };
      window.__TAURI__ = {
        event: { listen: async () => () => {} },
        core: { invoke: async (command, args) => {
          if (command === 'current_window_label') return 'main';
          if (command === 'load_browser_state') return {
            version: 3, activeId: 'test', tabLayout: 'horizontal', layoutPreferenceSet: true,
            groups: [], bookmarks: [{ title: '收藏', url: 'https://bookmark.example/path' }],
            tabs: [{ id: 'test', title: '新标签页', url: '', groupId: 'group-other', loading: false,
              hasWebview: false, sleeping: false, audible: false, muted: false }],
            history: [{ id: 'older', tabId: 'test', title: '较早历史',
              url: 'https://address.example/old', visitedAt: 1 }, { id: 'recent', tabId: 'test', title: '测试历史',
              url: 'http://address.example:11081/Case/entry', visitedAt: 2 }],
          };
          if (command === 'open_browser_tab') window.addressTest.navigations.push(args.url);
          return undefined;
        } },
      };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1440/');
    const input = page.getByRole('textbox', { name: '地址和搜索栏' });
    await input.waitFor();
    assert.equal(await page.locator('.address-shortcut').count(), 0, '地址栏不显示快捷键角标');
    await input.focus();
    await input.pressSequentially('address.ex');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'address.example:11081/Case/entry', 'Tab 应接受历史地址，不能失焦回填旧网址');
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
    const completedLength = 'address.example:11081/Case/entry'.length;
    assert.deepEqual(await input.evaluate(el => [el.selectionStart, el.selectionEnd]), [completedLength, completedLength]);
    assert.equal(await input.getAttribute('autocomplete'), 'off', '地址栏禁用原生表单候选');
    assert.equal(await input.locator('xpath=ancestor::form').getAttribute('autocomplete'), 'off');
    await input.press('Enter');
    await page.waitForFunction(() => window.addressTest.navigations.length === 1);
    assert.equal(await page.evaluate(() => window.addressTest.navigations[0]), 'http://address.example:11081/Case/entry');
    // 收藏也能补全；无候选时保留正常 Tab 焦点导航。
    await input.focus();
    await input.pressSequentially('bookmark.ex');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'bookmark.example/path');
    // 接受一次后再次 Tab 应正常移焦，不能把用户困在地址栏。
    await input.press('Tab');
    assert.equal(await input.evaluate(el => el === document.activeElement), false);
    await input.focus();
    await input.pressSequentially('bookmark.ex');
    await input.press('Shift+Tab');
    assert.equal(await input.evaluate(el => el === document.activeElement), false);
    // 删除选中的补全后缀后，不应立即补回；继续键入仍可再次匹配。
    await input.focus();
    await input.pressSequentially('address.ex');
    await input.press('Backspace');
    assert.equal(await input.inputValue(), 'address.ex');
    await input.pressSequentially('a');
    assert.equal(await input.inputValue(), 'address.example:11081/Case/entry');
    assert.equal(await input.evaluate(el => el.selectionStart), 'address.exa'.length);
    // 中间编辑和输入法组词不应擅自选择或追加候选。
    await input.fill('address.example!');
    await input.press('Home');
    await input.pressSequentially('x');
    assert.equal(await input.inputValue(), 'xaddress.example!');
    // 显式派发粘贴输入，避免自动化 fill 的 insertText 被当成真实键入。
    await input.evaluate(el => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'address.ex');
      el.setSelectionRange(10, 10);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: 'address.ex' }));
    });
    assert.equal(await input.inputValue(), 'address.ex');
    await input.evaluate(el => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      setValue.call(el, 'address.ex');
      el.setSelectionRange(10, 10);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x', isComposing: true }));
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
    assert.equal(await input.inputValue(), 'address.ex');
    // 未接受的行内候选也可直接回车导航，完整协议输入同样支持补全。
    await input.fill('');
    await input.pressSequentially('http://address.ex');
    assert.equal(await input.inputValue(), 'http://address.example:11081/Case/entry');
    await input.press('Enter');
    await page.waitForFunction(() => window.addressTest.navigations.length === 2);
    assert.equal(await page.evaluate(() => window.addressTest.navigations[1]), 'http://address.example:11081/Case/entry');
    await input.fill('unmatched query');
    await input.press('Tab');
    assert.equal(await input.evaluate(el => el === document.activeElement), false);
    // 失焦后的首次按下必须落在命中字符处，向左右拖动都只选择经过的文字。
    await input.evaluate(el => {
      window.addressTest.textDrags = 0;
      el.addEventListener('dragstart', () => { window.addressTest.textDrags++; });
    });
    for (const [from, to] of [[8, 18], [18, 8]]) {
      await input.evaluate(el => el.blur());
      assert.equal(await input.evaluate(el => el.selectionStart === el.selectionEnd), true, '失焦应清除旧选区');
      // 两次独立拖选间隔超过双击窗口，避免相同端点被系统识别为连续点击。
      await page.waitForTimeout(600);
      const points = await input.evaluate((el, { from, to }) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = style.font;
        const left = rect.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) - el.scrollLeft;
        return { start: left + context.measureText(el.value.slice(0, from)).width,
          end: left + context.measureText(el.value.slice(0, to)).width, y: rect.top + rect.height / 2 };
      }, { from, to });
      await page.mouse.move(points.start, points.y);
      await page.mouse.down();
      try {
        assert.deepEqual(await input.evaluate(el => [el.selectionStart, el.selectionEnd]), [from, from], '首次按下不能自动全选');
        await page.mouse.move(points.end, points.y, { steps: 12 });
      } finally { await page.mouse.up(); }
      assert.deepEqual(await input.evaluate(el => [el.selectionStart, el.selectionEnd]), [Math.min(from, to), Math.max(from, to)], '拖选必须以按下位置为起点');
    }
    assert.equal(await page.evaluate(() => window.addressTest.textDrags), 0, '首次拖选不能启动地址文本拖拽');
    // 键盘进入地址栏仍应全选，方便直接输入新地址。
    await input.evaluate(el => el.blur());
    await page.keyboard.press('Control+l');
    assert.deepEqual(await input.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, (await input.inputValue()).length]);
    assert.deepEqual(errors, [], '页面不能出现未捕获异常');
    console.log('PASS 地址栏：首次按下定位、双向拖选且不触发拖拽、Ctrl+L 全选、历史/收藏补全、Tab 接受与移焦、输入法、回车导航及原始协议。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
