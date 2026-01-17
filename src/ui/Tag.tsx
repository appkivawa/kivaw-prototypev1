import React from "react";

type TagProps = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "subtle";
};

export default function Tag({ label, selected = false, onClick, className = "", variant = "default" }: TagProps) {
  const variantClass = variant !== "default" ? `tag-${variant}` : "";
  return (
    <button
      onClick={onClick}
      className={`tag ${selected ? "tag-selected" : ""} ${variantClass} ${className}`.trim()}
      type="button"
    >
      {label}
    </button>
  );
}

