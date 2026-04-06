import type { ReactNode } from 'react';

type AlertVariant = 'red' | 'amber' | 'green' | 'blue';

const VARIANT: Record<
  AlertVariant,
  { bg: string; border: string; text: string }
> = {
  red: { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' },
  amber: { bg: '#fef3c7', border: '#f59e0b', text: '#d97706' },
  green: {
    bg: '#d1fae5',
    border: '#10b981',
    text: '#059669',
  },
  blue: { bg: '#f0f9ff', border: '#0ea5e9', text: '#0284c7' },
};

export default function Alert({
  variant,
  icon,
  children,
}: {
  variant: AlertVariant;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const v = VARIANT[variant];
  return (
    <div
      className="flex items-start gap-3 border rounded-xl px-4 py-3"
      style={{
        background: v.bg,
        borderColor: v.border,
        color: v.text,
        borderLeftWidth: 5,
      }}
    >
      {icon ? <div className="pt-0.5">{icon}</div> : null}
      <div className="text-sm font-semibold">{children}</div>
    </div>
  );
}

