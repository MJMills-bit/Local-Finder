import React from 'react';

export default function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="relative">
        {/* Outer ring */}
        <div className="h-10 w-10 rounded-full border-4 border-gray-200" />
        {/* Animated accent ring */}
        <div className="absolute inset-0 h-10 w-10 rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent animate-spin" />
      </div>

      <p className="mt-3 text-sm text-gray-500 tracking-wide">
        Loading, please wait…
      </p>
    </div>
  );
}
