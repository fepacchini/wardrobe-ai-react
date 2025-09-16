import React from 'react';

export function Badge({ children, variant = "default", className = "" }) {
  const variants = { default: "bg-black text-white", outline: "border border-gray-300 text-gray-700", secondary: "bg-gray-100 text-gray-800" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${variants[variant]} ${className}`}>{children}</span>;
}
