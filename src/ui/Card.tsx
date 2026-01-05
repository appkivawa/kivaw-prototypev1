import React from "react";

export default function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <section className={`card ${className}`} style={style}>{children}</section>;
}
