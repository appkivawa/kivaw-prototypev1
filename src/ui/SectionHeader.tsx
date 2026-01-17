import React from "react";

type SectionHeaderProps = {
  title: string;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};

export default function SectionHeader({ 
  title, 
  subtitle, 
  actions, 
  className = "",
  level = 2 
}: SectionHeaderProps) {
  const Heading = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <header className={`section-header ${className}`.trim()}>
      <div className="section-header-content">
        <Heading className="section-header-title">{title}</Heading>
        {subtitle && <p className="section-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="section-header-actions">{actions}</div>}
    </header>
  );
}

