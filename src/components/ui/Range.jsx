import React from 'react';

export function Range({ min = 0, max = 100, step = 1, value, onChange }) {
  return <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange?.(Number(e.target.value))} className="w-full" />;
}
