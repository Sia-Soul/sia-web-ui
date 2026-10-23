import { withTitleTooltip } from "./titleTooltip";
import { useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

/** 警告提示的状态类型。 */
export type AlertStatus = "info" | "success" | "warning" | "error";

/** 警告提示的属性配置。 */
export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** 当前状态，用于选择对应的状态样式。 */
  status?: AlertStatus;
  /** 类型标识，用于选择对应的表现形式。 */
  type?: AlertStatus;
  /** 标题内容，支持文本或 React 节点；message 未提供时使用。 */
  title?: ReactNode;
  /** 提示标题，支持文本或 React 节点，优先于 title；没有标题内容时不渲染标题区域。 */
  message?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 警告内容旁的业务操作节点。 */
  action?: ReactNode;
  /**
   * 是否显示实心状态图标；仅影响图标显隐，不改变状态颜色。
   * @defaultValue false
   */
  showIcon?: boolean;
  /**
   * 是否显示关闭入口。
   * @defaultValue false
   */
  closable?: boolean;
  /** 自定义关闭图标。 */
  closeIcon?: ReactNode;
  /**
   * 是否以通栏横幅形式显示。
   * @defaultValue false
   */
  banner?: boolean;
  /** 请求关闭时触发的回调。 */
  onClose?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** 关闭完成后调用。 */
  afterClose?: () => void;
}

// 提示状态优先使用框架实心图标；关闭及加载等操作图标保持各自语义。
const alertIcons: Record<AlertStatus, ReactNode> = {
  info: <Icon name="info" size={20} variant="filled" />,
  success: <Icon name="circle-check" size={20} variant="filled" />,
  warning: <Icon name="warning" size={20} variant="filled" />,
  error: <Icon name="circle-close" size={20} variant="filled" />,
};

/** 警告提示组件。 */
export function Alert({
  status, type, title, message, description, action, showIcon = false, closable = false, closeIcon,
  banner = false, onClose, afterClose, className = "", ...props
}: AlertProps) {
  const [visible, setVisible] = useState(true);
  const resolvedStatus = status ?? type ?? (banner ? "warning" : "info");
  const heading = message ?? title;
  // 空标题不生成网格行；数字 0 仍是有效标题内容。
  const hasHeading = heading != null && heading !== "" && typeof heading !== "boolean";
  if (!visible) return null;
  return (
    <div className={`sia-alert sia-alert--${resolvedStatus}${banner ? " sia-alert--banner" : ""}${description ? " sia-alert--with-description" : ""} ${className}`.trim()} role="alert" {...withTitleTooltip(props)}>
      {showIcon || banner ? <span className="sia-alert__icon" aria-hidden="true">{alertIcons[resolvedStatus]}</span> : null}
      <div className="sia-alert__content">
        {hasHeading ? <strong>{heading}</strong> : null}
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div className="sia-alert__action">{action}</div> : null}
      {closable ? <button type="button" className="sia-alert__close" aria-label="关闭提示" onClick={(event) => {
        onClose?.(event);
        setVisible(false);
        window.setTimeout(() => afterClose?.(), 0);
      }}>{closeIcon ?? <Icon name="close" size={14} />}</button> : null}
    </div>
  );
}
