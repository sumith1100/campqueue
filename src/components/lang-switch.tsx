"use client";

import { LANGUAGES, type Lang } from "@/lib/i18n";

export function LangSwitch({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-xl border-2 border-line bg-surface p-0.5">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => onChange(l.code)}
          aria-pressed={value === l.code}
          className={`min-h-10 rounded-[0.55rem] px-3 font-semibold ${
            value === l.code ? "bg-ink text-white" : "text-ink hover:bg-ground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
