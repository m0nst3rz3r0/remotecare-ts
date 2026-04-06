import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonSize = 'xs' | 'sm' | 'md';
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'teal' | 'amber';

const sizeCls: Record<ButtonSize, string> = {
  xs: 'text-xs px-2 py-1',
  sm: 'text-sm px-3 py-2',
  md: 'text-sm px-4 py-2.5',
};

const variantCls: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700',
  teal:
    'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700',
  amber:
    'bg-amber-500 text-white border border-amber-500 hover:bg-amber-600',
  ghost:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger:
    'bg-rose-500 text-white border border-rose-500 hover:bg-rose-600',
};

export default function Button({
  size = 'md',
  variant = 'primary',
  icon,
  label,
  className,
  type = 'button',
  children,
  ...rest
}: {
  size?: ButtonSize;
  variant?: ButtonVariant;
  icon?: ReactNode;
  label?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold',
        'transition-colors select-none',
        sizeCls[size],
        variantCls[variant],
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {icon ? <span className="leading-none">{icon}</span> : null}
      {label ? <span>{label}</span> : null}
      {children}
    </button>
  );
}

