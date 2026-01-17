import React from "react";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  spacing?: "none" | "sm" | "md" | "lg";
};

export default function Container({ 
  children, 
  className = "", 
  maxWidth = "xl",
  spacing = "md"
}: ContainerProps) {
  const maxWidthClass = `container-${maxWidth}`;
  const spacingClass = spacing !== "md" ? `container-spacing-${spacing}` : "";
  return (
    <div className={`container ${maxWidthClass} ${spacingClass} ${className}`.trim()}>
      {children}
    </div>
  );
}

