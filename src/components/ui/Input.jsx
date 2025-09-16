import React from 'react';

export function Input(props) { return <input {...props} className={`w-full rounded-xl border px-3 py-2 text-sm ${props.className || ""}`} />; }
