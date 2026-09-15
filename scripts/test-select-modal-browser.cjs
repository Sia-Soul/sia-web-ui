const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.argv[3]});
 try {
  const page = await browser.newPage({viewport:{width:1400,height:1000}});
  await page.goto('http://127.0.0.1:4173/components/select');
  const trigger = page.getByRole('combobox',{name:'弹框多选标签'});
  const dialog = page.getByRole('dialog');
  await trigger.click();
  await dialog.waitFor();
  assert.equal(await page.locator('.sia-select__dropdown:visible').count(),0);
  await dialog.getByRole('option',{name:'标签 1',exact:true}).click();
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert(!(await trigger.innerText()).includes('标签 1'));
  await trigger.click();
  await dialog.getByRole('option',{name:'标签 1',exact:true}).click();
  await dialog.getByRole('tab',{name:'已选项(1)',exact:true}).click();
  assert.equal(await dialog.getByRole('option').count(),1);
  await dialog.getByRole('tab',{name:'全部',exact:true}).click();
  await dialog.getByRole('textbox',{name:'搜索选项'}).fill('标签 8');
  await page.waitForTimeout(200);
  await dialog.getByRole('option',{name:'标签 8',exact:true}).click({force:true});
  assert(await dialog.getByRole('tab',{name:'已选项(1)',exact:true}).count());
  await dialog.getByRole('textbox',{name:'搜索选项'}).fill('不存在');
  await page.waitForTimeout(200);
  assert.equal(await dialog.getByRole('option').count(),0);
  await dialog.getByRole('textbox',{name:'搜索选项'}).fill('');
  await dialog.getByRole('button',{name:'确定',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert((await trigger.innerText()).includes('标签 1'));
  await page.getByRole('combobox',{name:'弹框单选框架'}).click();
  await dialog.getByRole('option',{name:'React',exact:true}).click();
  await dialog.getByRole('button',{name:'确定',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert((await page.getByRole('combobox',{name:'弹框单选框架'}).innerText()).includes('React'));
  await page.getByRole('combobox',{name:'选择项目成员',exact:true}).click();
  const popup = page.locator('.sia-select__dropdown:visible');
  const footer = popup.locator('.sia-select__actions');
  const before = await footer.boundingBox();
  await popup.locator('.sia-select__list').evaluate(el=>el.scrollTop=500);
  const after = await footer.boundingBox();
  assert(Math.abs(before.y-after.y)<1);
  await footer.getByRole('button',{name:'全选',exact:true}).click();
  await footer.getByRole('button',{name:'反选',exact:true}).click();
  assert(await footer.getByRole('button',{name:'清空',exact:true}).isDisabled());
  await page.keyboard.press('Escape');
  await trigger.click();
  await dialog.getByRole('textbox',{name:'搜索选项'}).fill(' 0 ');
  await page.waitForTimeout(200);
  assert.equal(await dialog.getByRole('option',{name:'标签 1',exact:true}).count(),1);
  assert.equal(await dialog.getByRole('option',{name:'标签 11',exact:true}).count(),1);
  assert.equal(await dialog.getByRole('option').count(),3);
  await dialog.getByRole('textbox',{name:'搜索选项'}).fill('');
  await page.waitForTimeout(200);
  const styles = await dialog.evaluate(el => {
    const option = el.querySelector('.sia-selection-panel__option');
    return {
      group: getComputedStyle(el.querySelector('.sia-selection-panel__group')).fontSize,
      option: getComputedStyle(option).fontSize,
      columns: getComputedStyle(el.querySelector('.sia-selection-panel__row')).gridTemplateColumns.split(' ').length,
      actions: [...el.querySelectorAll('.sia-select-modal__actions > *')].map(item=>getComputedStyle(item).fontSize),
      checkbox: !!option.querySelector('.sia-checkbox input[type="checkbox"]'),
      nowrap: getComputedStyle(option.querySelector('.sia-selection-panel__text')).whiteSpace,
    };
  });
  assert.equal(styles.group,'16px'); assert.equal(styles.option,'14px'); assert.equal(styles.columns,3);
  assert(styles.checkbox && styles.actions.every(size=>size==='14px')); assert.equal(styles.nowrap,'nowrap');
  const longOption = dialog.getByRole('option', {name:'这是一个用于演示单行省略的超长合作方店铺标签名称', exact:true});
  await longOption.scrollIntoViewIfNeeded();
  const overflow = await longOption.locator('.sia-selection-panel__label').evaluate(el => ({
    clipped: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow,
    height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight)
  }));
  assert(overflow.clipped && overflow.ellipsis === 'ellipsis' && overflow.height <= overflow.lineHeight + 1);
  await page.screenshot({path:require('node:path').join(process.env.TEMP,'select-modal-adjusted.png')});
  await dialog.getByRole('button',{name:'清空',exact:true}).click();
  assert.equal(await dialog.getByRole('tab',{name:'已选项(0)',exact:true}).count(),1);
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert((await trigger.innerText()).includes('标签 1'));
  await page.getByRole('combobox',{name:'显示值下拉选择',exact:true}).click();
  const valueOption = page.locator('.sia-select__dropdown:visible .sia-select__option').first();
  assert.equal(await valueOption.locator('.sia-select__option-label').innerText(),'React');
  assert.equal(await valueOption.locator('.sia-select__option-value').innerText(),'react');
  assert(await valueOption.locator('.sia-select__option-value').evaluate(el=>el.getBoundingClientRect().top >= el.previousElementSibling.getBoundingClientRect().bottom));
  await page.keyboard.press('Escape');
  await page.getByRole('combobox',{name:'显示值弹框选择',exact:true}).click();
  assert.equal(await dialog.locator('.sia-selection-panel__text small').first().innerText(),'react');
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  console.log('PASS: modal single/multiple, confirm/cancel, selected tab, search, disabled options, fixed dropdown footer and invert');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
