// 仅由浏览器外壳入口导入：捕获阶段覆盖透明边距和 Portal，仍让业务右键事件正常传播。
// 网页使用独立 WebView，不导入此模块，保留内核默认菜单与站点自定义菜单。
document.addEventListener("contextmenu", (event) => event.preventDefault(), { capture: true });
