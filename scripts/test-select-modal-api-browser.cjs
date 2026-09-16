const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/select');
    await page.getByRole('button', {name:'API 打开选择弹框',exact:true}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name:'取消',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    await page.evaluate(async () => {
      const { openSelectModal, Modal } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      window.confirmCalls = []; window.cancelCalls = 0; window.mode = 'false';
      window.openTest = (multiple = true) => {
        window.handle = openSelectModal({title:'独立选择',mode:multiple?'multiple':'single', value:multiple?['alpha']:null,
          options:[{value:'alpha',label:'甲',group:'分组一'},{value:'beta',label:'乙',group:'分组一'},{value:'locked',label:'禁用',disabled:true,group:'分组二'}],showValue:true,
          onCancel:()=>window.cancelCalls++, onConfirm:(value,option)=>{window.confirmCalls.push({value,option});if(window.mode==='false')return false;if(window.mode==='reject')return Promise.reject(Error('失败'));if(window.mode==='pending')return new Promise(resolve=>window.resolveConfirm=resolve);}
        });
      };
      window.destroyAll = () => Modal.destroyAll();
      window.openTest();
    });
    await dialog.waitFor();
    await dialog.getByRole('textbox',{name:'搜索选项'}).fill('BETA');
    await page.waitForTimeout(100);
    assert.equal(await dialog.getByRole('option').count(),1);
    await dialog.getByRole('option').click();
    await dialog.getByRole('textbox',{name:'搜索选项'}).fill('');
    await dialog.getByRole('button',{name:'确定',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.confirmCalls[0].value),['alpha','beta']);
    assert(await dialog.isVisible());
    await page.evaluate(()=>window.mode='reject');
    await dialog.getByRole('button',{name:'确定',exact:true}).click();
    assert(await dialog.isVisible());
    await page.evaluate(()=>window.handle.update({value:['beta'],title:'更新标题'}));
    await dialog.getByRole('tab',{name:'已选项(1)'}).waitFor();
    await page.evaluate(()=>window.mode='pending');
    await dialog.getByRole('button',{name:'确定',exact:true}).click();
    assert(await dialog.getByRole('button',{name:'取消',exact:true}).isDisabled());
    assert(await dialog.getByRole('textbox',{name:'搜索选项'}).isDisabled());
    await page.evaluate(()=>window.resolveConfirm());
    await dialog.waitFor({state:'hidden'});
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.sia-modal-api-host').count(),0);
    await page.evaluate(()=>{window.mode='ok';window.openTest(false)});
    await dialog.getByRole('option').filter({hasText:'乙'}).click();
    await dialog.getByRole('button',{name:'确定',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.confirmCalls.at(-1).value),'beta');
    await page.evaluate(()=>window.openTest());
    await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.cancelCalls),1);
    await page.evaluate(()=>window.openTest());await dialog.waitFor();
    await page.evaluate(()=>window.handle.destroy());await dialog.waitFor({state:'hidden'});
    await page.waitForTimeout(250);assert.equal(await page.locator('.sia-modal-api-host').count(),0);
    console.log('PASS direct API, value search, draft, single/multiple results, false/rejection retry, async lock, update, cancel and cleanup');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1});
