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
    'bg-[var(--teal)] text-white border border-[var(--teal)] hover:bg-[var(--teal2)]',
  teal:
    'bg-[var(--teal2)] text-white border border-[var(--teal2)] hover:bg-[var(--teal3)]',
  amber:
    'bg-[var(--amber)] text-white border border-[var(--amber)] hover:bg-[var(--amber)]/90',
  ghost:
    'bg-transparent text-[var(--teal)] border border-[var(--border)] hover:bg-[var(--teal-ultra)]',
  danger:
    'bg-[var(--rose)] text-white border border-[var(--rose)] hover:bg-[var(--rose)]/90',
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
        'inline-flex items-center justify-center gap-2 rounded-[var(--r-sm)] font-bold',
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

