import React from 'react';

export function Card({ children, className = "" }) { return <div className={`rounded-2xl border shadow-sm bg-white ${className}`}>{children}</div>; }
