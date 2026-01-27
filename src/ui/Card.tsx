import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void;
  variant?: "default" | "elevated" | "outlined";
  style?: React.CSSProperties;
};

export default function Card({ children, className = "", onClick, onMouseEnter, onMouseLeave, variant = "default", style }: CardProps) {
  const variantClass = variant !== "default" ? `card-${variant}` : "";
  return (
    <section 
      className={`card ${variantClass} ${className}`.trim()}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </section>
  );
}
