import Link from "next/link";
import { DC_BASE } from "@/lib/routes";

export default function SiteDepthChartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="border-b border-rule bg-paper-raised">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2 font-data text-xs">
            <Link href="/" className="text-ink-soft hover:text-navy">
              All Divisions
            </Link>
            <span className="text-ink-soft">/</span>
            <Link href={DC_BASE} className="font-medium text-navy">
              Site Depth Charts and Performance
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`${DC_BASE}/division-resources`}
              className="text-xs font-medium text-ink-soft hover:text-navy"
            >
              Division Resources
            </Link>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
