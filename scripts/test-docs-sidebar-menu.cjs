// 验证示例导航直接使用 Menu，并覆盖长目录、路由历史、图标折叠和移动端。
const assert = require('node:assert/strict');
const {chromium} = require(process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/components/pagination');
 const menu=page.locator('.docs-sidebar-menu');await menu.waitFor();
 const item=key=>menu.locator(`[data-menu-key="${key}"]`);
 await page.waitForTimeout(450);
 assert.equal(await item('/components/pagination').getAttribute('aria-current'),'page');
 await item('/components/menu').click();await page.waitForURL('**/components/menu');
 await page.goBack();await page.waitForURL('**/components/pagination');
 await item('group:数据录入').click();await page.waitForTimeout(300);
 const group=item('group:数据录入').locator('..').locator(':scope > ul');
 const metrics=await group.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
 assert.ok(metrics.height>640,JSON.stringify(metrics));
 assert.ok(metrics.scroll<=metrics.height+1,JSON.stringify(metrics));
 await item('/components/query-form').click();await page.waitForURL('**/components/query-form');
 await page.locator('.desktop-only').click();await page.waitForTimeout(300);
 assert.ok(await menu.evaluate(el=>el.classList.contains('sia-menu--collapsed')));
 assert.equal(await item('/components/menu').getAttribute('aria-label'),'Menu 菜单');
 await item('branch:/components/chart').click();
 const popup=page.locator('.sia-menu__popup');await popup.waitFor();
 await popup.locator('[data-menu-key="/components/chart"]').click();await page.waitForURL('**/components/chart');
 await page.locator('.desktop-only').click();await page.waitForTimeout(350);
 assert.equal(await item('/components/chart').getAttribute('aria-current'),'page');
 assert.equal(await item('branch:/components/chart').getAttribute('aria-expanded'),'true');
 await page.screenshot({path:'logs/docs-menu-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'打开侧边栏',exact:true}).click();
 await item('/components/menu').click();await page.waitForURL('**/components/menu');
 assert.ok(!await page.locator('.docs-app').evaluate(el=>el.classList.contains('is-mobile-open')));
 await page.getByRole('button',{name:'打开侧边栏',exact:true}).click();
 await page.waitForTimeout(250);
 await page.screenshot({path:'logs/docs-menu-mobile.png'});
 assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).x),0);
 // 深色主题保留清楚的选中背景及白色文字。
 await page.evaluate(()=>document.documentElement.dataset.siaTheme='dark');
 await page.screenshot({path:'logs/docs-menu-dark.png'});
 assert.equal(await item('/components/menu').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
 assert.deepEqual(errors,[]);console.log('PASS docs Menu navigation',metrics);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
