import React from 'react';

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'teal'
  | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; dotColor: string; border: string }> = {
    success: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
      border: 'border-emerald-200',
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      dotColor: 'bg-amber-500',
      border: 'border-amber-200',
    },
    danger: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      dotColor: 'bg-rose-500',
      border: 'border-rose-200',
    },
    info: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      dotColor: 'bg-sky-500',
      border: 'border-sky-200',
    },
    teal: {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      dotColor: 'bg-teal-600',
      border: 'border-teal-200',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      dotColor: 'bg-purple-500',
      border: 'border-purple-200',
    },
    neutral: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      dotColor: 'bg-slate-400',
      border: 'border-slate-200',
    },
  };

  const style = variantStyles[variant];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${style.dotColor}`} />}
      {children}
    </span>
  );
};
