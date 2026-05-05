import { cn } from "@/lib/utils/cn";

export type SlotFilter = "all" | "available" | "evening" | "discount";

const FILTERS: { id: SlotFilter; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "•" },
  { id: "available", label: "Free only", icon: "✓" },
  { id: "evening", label: "Evening", icon: "🌙" },
  { id: "discount", label: "Discounts", icon: "🏷" },
];

export function FilterBar({ active }: { active: SlotFilter }) {
  return (
    <nav
      aria-label="Slot filter"
      className="sticky top-2 z-10 -mx-4 overflow-x-auto px-4"
    >
      <ul className="flex gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1 backdrop-blur-xl shadow-lg">
        {FILTERS.map((f) => {
          const isActive = f.id === active;
          const params = new URLSearchParams();
          if (f.id !== "all") params.set("filter", f.id);
          return (
            <li key={f.id}>
              <a
                href={params.toString() ? `/book?${params.toString()}` : "/book"}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-xl px-3 text-xs font-semibold transition",
                  isActive
                    ? "bg-white text-pitch-900 shadow"
                    : "text-white/85 hover:bg-white/10",
                )}
              >
                <span aria-hidden>{f.icon}</span>
                {f.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
