import React from 'react';

export function Button({ children, className = "", variant = "default", size = "md", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl border transition disabled:opacity-50";
  const variants = {
    default: "bg-black text-white border-black hover:opacity-90",
    outline: "bg-white text-black border-gray-300 hover:bg-gray-50",
    secondary: "bg-gray-100 text-black border-gray-200 hover:bg-gray-200",
  };
  const sizes = { sm: "px-2 py-1 text-xs", md: "px-3 py-2 text-sm", lg: "px-4 py-2.5" };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>
  );
}
