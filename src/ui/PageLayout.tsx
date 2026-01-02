import React from "react";
import Card from "./Card";

type Props = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function PageLayout({
  title,
  subtitle,
  rightSlot,
  children,
  className = "",
}: Props) {
  return (
    <div className={`page app-page ${className}`}>
      <div className="app-wrap">
        {(title || subtitle || rightSlot) && (
          <div className="app-header">
            <div className="app-header-text">
              {title && <h1 className="app-title">{title}</h1>}
              {subtitle && <p className="app-subtitle">{subtitle}</p>}
            </div>
            {rightSlot && <div className="app-header-right">{rightSlot}</div>}
          </div>
        )}

        <Card className="app-card">{children}</Card>
      </div>
    </div>
  );
}
