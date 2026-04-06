import type { ReactNode } from 'react';

export default function Card({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl">
      {header ? (
        <div className="border-b border-slate-200 px-4 py-3">
          {header}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

