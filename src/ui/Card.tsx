import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "default" | "elevated" | "outlined";
};

export default function Card({ children, className = "", onClick, variant = "default" }: CardProps) {
  const variantClass = variant !== "default" ? `card-${variant}` : "";
  return (
    <section 
      className={`card ${variantClass} ${className}`.trim()}
      onClick={onClick}
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
