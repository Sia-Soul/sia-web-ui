import { initializeDefaultScrollbars } from "./components/FloatingScrollbarProvider";

// 浏览器入口默认接管滚动容器，服务端导入不访问 DOM。
initializeDefaultScrollbars();

export { SelectDateRange } from "./components/SelectDateRange";
export type { SelectDateRangeProps, SelectDateRangeValue } from "./components/SelectDateRange";
