"use client";

import { useEffect, useState } from "react";

let cachedNames: string[] | null = null;

export function useKnownNames() {
  const [names, setNames] = useState<string[]>(cachedNames ?? []);
  useEffect(() => {
    if (cachedNames) {
      setNames(cachedNames);
      return;
    }
    fetch("/api/mentions/known-names")
      .then((r) => r.json())
      .then((d) => {
        cachedNames = d.names ?? [];
        setNames(cachedNames ?? []);
      });
  }, []);
  return names;
}

export function MentionDropdown({
  query,
  names,
  onPick,
}: {
  query: string;
  names: string[];
  onPick: (name: string) => void;
}) {
  const filtered = names.filter((n) => n.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  if (filtered.length === 0) return null;
  return (
    <div className="mention-dropdown">
      {filtered.map((n) => (
        <button
          key={n}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(n);
          }}
        >
          @{n}
        </button>
      ))}
    </div>
  );
}
