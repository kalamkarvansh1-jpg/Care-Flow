import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipLabelProps {
  label: string;
  tooltip: string;
  className?: string;
}

export const TooltipLabel: React.FC<TooltipLabelProps> = ({ label, tooltip, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={`inline-flex items-center gap-1 relative ${className}`}>
      <span className="text-slate-500 font-medium text-xs">{label}</span>
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-help"
        aria-label={`Definition for ${label}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 p-2 bg-slate-900 text-slate-100 text-[11px] leading-relaxed rounded-md shadow-lg z-50 pointer-events-none"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
};
