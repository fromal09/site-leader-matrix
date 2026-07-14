export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-rule-strong bg-white px-2.5 py-2">
      <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      <div className="font-data text-base font-semibold text-ink">{value}</div>
      {sub && <div className="text-[10px] text-ink-soft">{sub}</div>}
    </div>
  );
}
