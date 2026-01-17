import React from "react";
import Button from "./Button";

type EmptyStateProps = {
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  className?: string;
  children?: React.ReactNode;
};

export default function EmptyState({ title, message, action, className = "", children }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {action && (
        <div className="empty-state-actions">
          <Button
            onClick={action.onClick}
            disabled={action.disabled}
            variant="primary"
            size="md"
          >
            {action.label}
          </Button>
        </div>
      )}
      {children && <div className="empty-state-children">{children}</div>}
    </div>
  );
}

