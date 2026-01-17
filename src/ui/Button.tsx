import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "text";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  className?: string;
};

export default function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  type = "button",
  fullWidth = false,
  className = "",
}: ButtonProps) {
  const baseClass = "btn";
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  const widthClass = fullWidth ? "btn-full" : "";
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

