// Helper to detect if a string is a URL
export function isIconUrl(icon: string): boolean {
  return icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

// Icon renderer component
import React from "react";

interface IconProps {
  icon: string;
  /** Size in px — applies to both emoji font-size and img dimensions */
  size?: number;
  className?: string;
}

export function IconRenderer({ icon, size = 48, className = "" }: IconProps) {
  if (isIconUrl(icon)) {
    return (
      <img
        src={icon}
        alt="icon"
        draggable={false}
        className={`object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  // Emoji — set font-size directly so it fills the container naturally
  return (
    <span
      className={`leading-none select-none ${className}`}
      style={{ fontSize: size }}
    >
      {icon}
    </span>
  );
}
