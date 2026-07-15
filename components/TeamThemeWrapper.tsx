"use client";

import { teamColor } from "@/lib/nflTeamColors";

export function TeamThemeWrapper({
  siteTopic,
  children,
}: {
  siteTopic: string;
  children: React.ReactNode;
}) {
  const colors = teamColor(siteTopic);
  return (
    <div
      style={
        {
          "--navy": colors.primary,
          "--navy-soft": `color-mix(in srgb, ${colors.primary} 80%, black)`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
