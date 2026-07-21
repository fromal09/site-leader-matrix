export function DeltaValue({
  value,
  format,
}: {
  value: number;
  format: (v: number) => string;
}) {
  if (value === 0) {
    return <span className="text-ink-soft">—</span>;
  }
  const positive = value > 0;
  return (
    <span
      className="font-semibold"
      style={{ color: positive ? "var(--grade-good)" : "var(--grease-red)" }}
    >
      {positive ? "+" : ""}
      {format(value)}
    </span>
  );
}
