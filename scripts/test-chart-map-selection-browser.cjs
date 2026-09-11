const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartMapSelectionSource.json')[0];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));
 const preview=page.locator('.chart-map-selection');await preview.scrollIntoViewIfNeeded();
 const marks=preview.locator('[data-map-region]'),result=preview.getByRole('status');
 assert.equal(await marks.count(),34);assert.equal(await preview.locator('.sia-chart__visual-map').count(),0);
 assert.equal(await result.textContent(),'');
 assert.deepEqual(await preview.locator('[aria-selected="true"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-map-region'))),['广东']);
 const names=await marks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-map-region')));
 for(const name of names){const mark=preview.locator(`[data-map-region="${name}"]`);await mark.focus();assert.equal(await preview.getByRole('tooltip').textContent(),name);const before=await mark.getAttribute('aria-selected');await page.keyboard.press('Enter');assert.equal(await mark.getAttribute('aria-selected'),before==='true'?'false':'true');await page.keyboard.press('Space');assert.equal(await mark.getAttribute('aria-selected'),before);}
 const xinjiang=preview.locator('[data-map-region="新疆"]');const label=await xinjiang.locator('text').boundingBox();
 await page.mouse.move(label.x+label.width/2,label.y+label.height/2);await page.mouse.click(label.x+label.width/2,label.y+label.height/2);
 assert.equal(await xinjiang.getAttribute('aria-selected'),'true');assert.ok((await result.textContent()).includes('新疆'));
 await preview.locator('[data-map-region="广东"]').focus();await page.keyboard.press('Enter');
 assert.equal(await result.textContent(),'当前选择： 新疆');
 await xinjiang.focus();await page.keyboard.press('Enter');assert.equal(await result.textContent(),'当前选择： ');
 await page.reload();await preview.waitFor();assert.equal(await preview.locator('[data-map-region="广东"]').getAttribute('aria-selected'),'true');assert.equal(await result.textContent(),'');
 await preview.screenshot({path:'apps/docs/chart-map2-preview.png'});assert.deepEqual(errors,[]);console.log('map2：34地区提示/多选、广东初始选择、实际鼠标选择、结果事件及刷新通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
