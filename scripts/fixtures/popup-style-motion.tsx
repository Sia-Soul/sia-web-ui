import { createRoot } from "react-dom/client";
import { Select } from "../../packages/react/src/components/Select";
import { FloatingScrollbarProvider } from "../../packages/react/src/components/FloatingScrollbarProvider";
import "../../packages/react/src/styles.css";
import "../../packages/react/src/components-extra.css";
import "../../packages/react/src/overlay-borders.css";

// 使用真实选项与滚动条接管，覆盖普通列表和窗口化长列表的面板开合。
const options = Array.from({ length: 1000 }, (_, index) => ({ value: index, label: `选项 ${index + 1}` }));
document.body.style.background = "var(--sia-color-background)";
document.body.style.color = "var(--sia-color-text)";
createRoot(document.getElementById("root")!).render(<div style={{ padding: 40, display: "flex", gap: 24 }}>
  <FloatingScrollbarProvider />
  {/* 与弹层无关的背景区域用于检查开合不会重新扫描整页。 */}
  <div id="unrelated-probe" style={{ position: "absolute", top: 700 }}>背景内容</div>
  <Select aria-label="普通列表" style={{ width: 280 }} defaultValue={0} options={options.slice(0, 15)} />
  <Select aria-label="长列表" style={{ width: 280 }} popupMode="dropdown" options={options} />
</div>);
