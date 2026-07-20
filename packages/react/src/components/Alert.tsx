import { useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export type AlertStatus = "info" | "success" | "warning" | "error";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  status?: AlertStatus;
  type?: AlertStatus;
  title?: ReactNode;
  message?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  showIcon?: boolean;
  closable?: boolean;
  closeIcon?: ReactNode;
  banner?: boolean;
  onClose?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  afterClose?: () => void;
}

const alertIcons: Record<AlertStatus, ReactNode> = {
  info: <Icon name="info" variant="filled" />,
  success: <Icon name="circle-check" variant="filled" />,
  warning: <Icon name="warning" variant="filled" />,
  error: <Icon name="circle-close" variant="filled" />,
};

export function Alert({
  status, type, title, message, description, action, showIcon = false, closable = false, closeIcon,
  banner = false, onClose, afterClose, className = "", ...props
}: AlertProps) {
  const [visible, setVisible] = useState(true);
  const resolvedStatus = status ?? type ?? (banner ? "warning" : "info");
  if (!visible) return null;
  return (
    <div className={`sia-alert sia-alert--${resolvedStatus}${banner ? " sia-alert--banner" : ""}${description ? " sia-alert--with-description" : ""} ${className}`.trim()} role="alert" {...props}>
      {showIcon || banner ? <span className="sia-alert__icon" aria-hidden="true">{alertIcons[resolvedStatus]}</span> : null}
      <div className="sia-alert__content">
        <strong>{message ?? title}</strong>
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
