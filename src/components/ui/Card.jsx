import React from 'react';

export function Card({ children, className = "" }) { 
  return <div className={`rounded-2xl border shadow-sm bg-white ${className}`}>{children}</div>; 
}

export function CardHeader({ children, className = "" }) { 
  return <div className={`p-4 border-b ${className}`}>{children}</div>; 
}

export function CardTitle({ children, className = "" }) { 
  return <div className={`text-lg font-semibold ${className}`}>{children}</div>; 
}

export function CardContent({ children, className = "" }) { 
  return <div className={`p-4 ${className}`}>{children}</div>; 
}
