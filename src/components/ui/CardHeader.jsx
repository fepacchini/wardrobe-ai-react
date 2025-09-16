import React from 'react';

export function CardHeader({ children, className = "" }) { return <div className={`p-4 border-b ${className}`}>{children}</div>; }
