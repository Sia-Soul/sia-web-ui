/** 编译实际隐藏函数并以模拟 WebView 统计原生调用，避免依赖完整 Tauri 构建。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/browser/src-tauri/src/lib.rs'), 'utf8');
const start = source.indexOf('fn hide_browser_webviews(');
const end = source.indexOf('\n#[tauri::command]', start);
assert.ok(start >= 0 && end > start);
const visibilityPath = path.join(root, 'apps/browser/src-tauri/src/browser_visibility.rs');
const visibility = fs.existsSync(visibilityPath) ? fs.readFileSync(visibilityPath, 'utf8').replace(/^\/\/!.*$/gm, '') : '';
const fixture = `
use std::{cell::Cell, collections::HashMap, rc::Rc};
mod browser_visibility { ${visibility} }
const BROWSER_WEBVIEW_PREFIX: &str = "browser-tab-";
#[derive(Clone)]
struct View { calls: Rc<Cell<usize>> }
impl View { fn hide(&self) -> Result<(), String> { self.calls.set(self.calls.get() + 1); Ok(()) } }
struct AppHandle {
    views: HashMap<String, View>,
    ${visibility ? 'cache: browser_visibility::BrowserVisibility,' : ''}
}
impl AppHandle {
    fn webviews(&self) -> HashMap<String, View> { self.views.clone() }
    ${visibility ? 'fn state<T: std::any::Any>(&self) -> &T { (&self.cache as &dyn std::any::Any).downcast_ref().unwrap() }' : ''}
}
${source.slice(start, end)}
fn main() {
    let calls = Rc::new(Cell::new(0));
    let app = AppHandle {
        views: (0..100).map(|i| (format!("browser-tab-{i}"), View { calls: calls.clone() })).collect(),
        ${visibility ? 'cache: Default::default(),' : ''}
    };
    hide_browser_webviews(&app, Some("browser-tab-0")).unwrap();
    assert_eq!(calls.get(), 99);
    ${visibility ? 'app.cache.mark_visible("browser-tab-1").unwrap();' : ''}
    calls.set(0);
    hide_browser_webviews(&app, Some("browser-tab-1")).unwrap();
    assert_eq!(calls.get(), 1, "切换已有标签只应隐藏上一页，不能重复隐藏其余 98 页");
    calls.set(0);
    hide_browser_webviews(&app, Some("browser-tab-1")).unwrap();
    assert_eq!(calls.get(), 0, "重复同步不能再次发送隐藏命令");
    hide_browser_webviews(&app, None).unwrap();
    assert_eq!(calls.get(), 1, "进入空白页应隐藏当前网页");
    ${visibility ? `
    app.cache.mark_visible("browser-tab-1").unwrap();
    let revision = app.cache.hide_revision("browser-tab-1").unwrap().unwrap();
    app.cache.mark_visible("browser-tab-1").unwrap();
    app.cache.mark_hidden("browser-tab-1", revision).unwrap();
    assert!(app.cache.hide_revision("browser-tab-1").unwrap().is_some(), "显示请求之后的过期隐藏回调不能写入缓存");
    ` : ''}
}
`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-switch-cost-'));
try {
  const input = path.join(directory, 'fixture.rs');
  const output = path.join(directory, 'fixture.exe');
  fs.writeFileSync(input, fixture, 'utf8');
  execFileSync('rustc', ['--edition=2021', input, '-o', output], { stdio: 'pipe' });
  execFileSync(output, [], { stdio: 'pipe' });
  console.log('PASS 100 标签切换：隐藏调用 99 → 1；重复同步 0 次；空白页正确隐藏当前网页');
} finally {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('sia-switch-cost-'));
  fs.rmSync(directory, { recursive: true, force: true });
}
