export function StatTile({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  tint?: { text: string; bg: string } | null;
}) {
  return (
    <div
      className="rounded border border-rule-strong px-2.5 py-2"
      style={tint ? { backgroundColor: tint.bg, borderColor: tint.text } : { backgroundColor: "white" }}
    >
      <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      <div
        className="font-data text-base font-semibold"
        style={{ color: tint ? tint.text : "var(--ink)" }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-ink-soft">{sub}</div>}
    </div>
  );
}
