export default function Badge({
  value,
  cls,
}: {
  value: number;
  cls?: string;
}) {
  if (!value || value <= 0) return null;

  return (
    <span
      className={[
        'ml-2 inline-flex items-center justify-center px-2 py-[1px] rounded-full',
        'text-[10px] font-extrabold',
        'bg-[var(--teal-pale)] text-[var(--teal)]',
        cls ?? '',
      ].join(' ')}
    >
      {value}
    </span>
  );
}

