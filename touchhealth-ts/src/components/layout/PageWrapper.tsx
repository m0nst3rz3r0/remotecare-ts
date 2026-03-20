import type { ReactNode } from 'react';

export default function PageWrapper({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="p-3 md:p-5">
      {title ? (
        <div className="mb-3">
          <h1 className="font-syne text-[18px] font-extrabold text-[var(--ink)]">
            {title}
          </h1>
        </div>
      ) : null}
      {children}
    </div>
  );
}

