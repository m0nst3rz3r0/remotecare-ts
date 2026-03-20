import type { ReactNode } from 'react';

export default function Card({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-[var(--border)] rounded-[var(--r)] shadow-[var(--shadow)]">
      {header ? (
        <div className="border-b border-[var(--border)] px-4 py-3">
          {header}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

