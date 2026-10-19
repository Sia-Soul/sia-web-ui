import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "./result.css";

/** 结果页的语义状态，决定默认图标及其颜色。 */
export type ResultStatus = "success" | "error" | "info" | "warning";

/** 操作结果展示的属性；不执行请求，不自动生成重试或返回操作。 */
export interface ResultProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** 状态图标的语义与颜色；不改变业务执行结果。默认 info。 */
  status?: ResultStatus;
  /** 结果标题，可传入文本或节点；未传时不占据标题空间。 */
  title?: ReactNode;
  /** 标题下的补充说明；长文本自动换行。 */
  subTitle?: ReactNode;
  /** 替换默认状态图标；null 或 false 隐藏图标及其占位，undefined 使用状态图标。 */
  icon?: ReactNode;
  /** 结果操作区，通常传入 Button；操作行为和加载状态由调用方管理。 */
  extra?: ReactNode;
  /** 补充详情，显示在说明之后、操作区之前；不自动添加边框。 */
  children?: ReactNode;
}

const icons: Record<ResultStatus, IconName> = {
  success: "circle-check", error: "circle-close", info: "info", warning: "warning",
};

/** 用于导入、提交等操作完成后的结果展示，支持自定义图标、详情和操作。 */
export function Result({ status = "info", title, subTitle, icon, extra, children, className = "", ...props }: ResultProps) {
  const resultIcon = icon === undefined ? <Icon name={icons[status]} size={72} variant="filled" /> : icon;
  // 显式 null/false 不保留空白；0 等合法 React 内容仍正常显示。
  const present = (value: ReactNode) => value !== undefined && value !== null && value !== false;
  return <div {...props} className={`sia-result sia-result--${status} ${className}`.trim()}>
    {present(resultIcon) && <div className="sia-result__icon" aria-hidden="true">{resultIcon}</div>}
    {present(title) && <div className="sia-result__title">{title}</div>}
    {present(subTitle) && <div className="sia-result__subtitle">{subTitle}</div>}
    {present(children) && <div className="sia-result__content">{children}</div>}
    {present(extra) && <div className="sia-result__extra">{extra}</div>}
  </div>;
}
