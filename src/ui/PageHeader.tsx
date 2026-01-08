import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode | string;
  align?: "center" | "left";
  maxWidth?: string;
}

export default function PageHeader({ title, subtitle, icon, align = "center", maxWidth }: PageHeaderProps) {
  return (
    <div className="page-header" style={{ textAlign: align, maxWidth: maxWidth || undefined }}>
      {icon && (
        <div className="page-header-icon">
          {typeof icon === "string" ? <span>{icon}</span> : icon}
        </div>
      )}
      <h1 className="page-header-title page-title">{title}</h1>
      {subtitle && <p className="page-header-subtitle page-subtitle">{subtitle}</p>}
    </div>
  );
}

