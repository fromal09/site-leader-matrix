export function NotebookSpiral() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-0 left-0 top-0 z-40 w-8"
      style={{
        backgroundImage: `
          radial-gradient(circle at 16px 14px, transparent 5px, rgba(90,90,90,0.55) 5px, rgba(90,90,90,0.55) 6.5px, transparent 7px),
          radial-gradient(circle at 16px 14px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)
        `,
        backgroundSize: "32px 28px, 32px 28px",
        backgroundRepeat: "repeat-y",
        boxShadow: "10px 0 14px -10px rgba(20, 24, 31, 0.25) inset",
      }}
    />
  );
}
