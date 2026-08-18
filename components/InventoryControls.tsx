"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS, type Facets, type FilterKey } from "@/lib/inventory";

const STATE_TABS = [
  { value: "open", label: "All open" },
  { value: "live", label: "Live now" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ended", label: "Closed" },
] as const;

const GRADE_STEPS = [
  { value: "", label: "Any" },
  { value: "2", label: "2.0+" },
  { value: "3", label: "3.0+" },
  { value: "4", label: "4.0+" },
];
const PRICE_STEPS = [
  { value: "", label: "Any" },
  { value: "10000", label: "Under $10k" },
  { value: "20000", label: "Under $20k" },
  { value: "30000", label: "Under $30k" },
  { value: "50000", label: "Under $50k" },
];

/**
 * Owns the inventory page layout and takes the results grid as `children`.
 *
 * The grid stays a server component — it is rendered on the server and passed
 * through this client boundary as an already-formed React element, so none of
 * the vehicle data or formatting code ships to the browser. Only the controls
 * themselves are client-side.
 */
export function InventoryControls({
  facets,
  total,
  activeCount,
  children,
}: {
  facets: Facets;
  total: number;
  activeCount: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");

  /**
   * Every control writes to the URL and lets the server re-render. Wrapping the
   * push in a transition keeps the current results on screen (dimmed) while the
   * new ones stream in, instead of blanking the grid on each keystroke.
   */
  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page"); // any filter change returns to page one
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce the search box so typing "silverado" fires one query, not nine.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (searchDraft === current) return;

    const timer = setTimeout(() => {
      apply((params) => {
        if (searchDraft) params.set("q", searchDraft);
        else params.delete("q");
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDraft, searchParams, apply]);

  const toggleValue = (key: FilterKey, value: string) => {
    apply((params) => {
      const current = params.get(key)?.split(",").filter(Boolean) ?? [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (next.length) params.set(key, next.join(","));
      else params.delete(key);
    });
  };

  const isChecked = (key: FilterKey, value: string) =>
    (searchParams.get(key)?.split(",") ?? []).includes(value);

  const setSingle = (key: string, value: string) => {
    apply((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  };

  const clearAll = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      const state = searchParams.get("state");
      if (state) params.set("state", state);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
    setSearchDraft("");
  };

  const state = searchParams.get("state") ?? "open";

  const filterGroups: { key: FilterKey; label: string }[] = [
    { key: "make", label: "Make" },
    { key: "bodyStyle", label: "Body style" },
    { key: "fuelType", label: "Fuel" },
    { key: "province", label: "Province" },
    { key: "titleStatus", label: "Title" },
  ];

  const panel = (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Condition grade
        </p>
        <div className="flex flex-wrap gap-1.5">
          {GRADE_STEPS.map((step) => (
            <Chip
              key={step.value}
              active={(searchParams.get("minGrade") ?? "") === step.value}
              onClick={() => setSingle("minGrade", step.value)}
            >
              {step.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Current price
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_STEPS.map((step) => (
            <Chip
              key={step.value}
              active={(searchParams.get("maxPrice") ?? "") === step.value}
              onClick={() => setSingle("maxPrice", step.value)}
            >
              {step.label}
            </Chip>
          ))}
        </div>
      </div>

      {filterGroups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {facets[group.key].map((facet) => (
              <Chip
                key={facet.value}
                active={isChecked(group.key, facet.value)}
                // A zero count only ever appears on an option you have
                // selected, so it stays clickable in order to be de-selectable.
                disabled={facet.count === 0 && !isChecked(group.key, facet.value)}
                onClick={() => toggleValue(group.key, facet.value)}
              >
                <span className="capitalize">{facet.value}</span>
                <span className="tnum ml-1 opacity-50">{facet.count}</span>
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Search + sort + state tabs */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-ink-faint stroke-[1.6]"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search make, model, VIN, lot, city, dealership…"
              aria-label="Search inventory"
              className="h-10 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-[14px] placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-[13px] font-medium lg:hidden"
          >
            Filters
            {activeCount > 0 && (
              <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-canvas">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* The four state tabs plus a sort control do not fit on a 390px
            screen. Rather than wrapping into a ragged block, the tabs scroll
            horizontally as one strip and the sort row sits beneath them. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max rounded-lg border border-hairline bg-surface p-0.5">
            {STATE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSingle("state", tab.value)}
                aria-pressed={state === tab.value}
                className={`whitespace-nowrap rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  state === tab.value ? "bg-raised text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <select
            value={searchParams.get("sort") ?? "ending_soon"}
            onChange={(event) => setSingle("sort", event.target.value)}
            aria-label="Sort results"
            className="h-9 min-w-0 max-w-[60%] rounded-lg border border-hairline bg-surface px-2.5 text-[13px] focus:border-accent focus:outline-none"
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              Clear filters
            </button>
          )}

          <p
            className={`tnum ml-auto flex-none text-[13px] text-ink-muted transition-opacity ${
              isPending ? "opacity-40" : ""
            }`}
            aria-live="polite"
          >
            {total} {total === 1 ? "lot" : "lots"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[224px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pb-4 pr-2">
            {panel}
          </div>
        </aside>

        <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>{children}</div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-canvas/70"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface p-5 pb-8"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md bg-raised px-3 py-1.5 text-[13px] font-medium"
              >
                Done
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-hairline bg-surface text-ink-muted hover:border-hairline-strong hover:text-ink"
      } ${disabled ? "cursor-not-allowed opacity-35 hover:border-hairline hover:text-ink-muted" : ""}`}
    >
      {children}
    </button>
  );
}
