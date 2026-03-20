import type { ReactNode } from 'react';

export default function Chip({
  cls,
  children,
  title,
}: {
  cls?: string;
  children: ReactNode;
  title?: string;
}) {
  const extra = cls ? ` ${cls}` : '';
  return (
    <span className={`chip${extra}`} title={title}>
      {children}
    </span>
  );
}

