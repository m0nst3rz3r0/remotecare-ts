import type { ReactNode } from 'react';

type AlertVariant = 'red' | 'amber' | 'green' | 'blue';

const VARIANT: Record<
  AlertVariant,
  { bg: string; border: string; text: string }
> = {
  red: { bg: 'var(--rose-pale)', border: 'var(--rose)', text: 'var(--rose)' },
  amber: { bg: 'var(--amber-pale)', border: 'var(--amber)', text: 'var(--amber)' },
  green: {
    bg: 'var(--emerald-pale)',
    border: 'var(--emerald)',
    text: 'var(--emerald)',
  },
  blue: { bg: 'var(--teal-pale)', border: 'var(--teal)', text: 'var(--teal)' },
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
      className="flex items-start gap-3 border rounded-[var(--r)] px-4 py-3"
      style={{
        background: v.bg,
        borderColor: v.border,
        color: v.text,
        borderLeftWidth: 5,
      }}
    >
      {icon ? <div className="pt-0.5">{icon}</div> : null}
      <div className="text-sm font-bold">{children}</div>
    </div>
  );
}

