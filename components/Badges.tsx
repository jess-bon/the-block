import { gradeBand, type AuctionState } from "@/lib/auction";

export function StateBadge({ state }: { state: AuctionState }) {
  if (state === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-live">
        <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
        Live
      </span>
    );
  }

  if (state === "upcoming") {
    return (
      <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
        Upcoming
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-hairline px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
      Closed
    </span>
  );
}

export function GradeBadge({ grade, size = "sm" }: { grade: number; size?: "sm" | "lg" }) {
  const band = gradeBand(grade);
  const tone = {
    good: "bg-good-soft text-good",
    fair: "bg-live-soft text-live",
    poor: "bg-warn-soft text-warn",
    severe: "bg-warn text-white",
  }[band.tone];

  if (size === "lg") {
    return (
      <div className={`flex items-baseline gap-2 rounded-lg px-3 py-2 ${tone}`}>
        <span className="tnum text-2xl font-bold leading-none">{grade.toFixed(1)}</span>
        <span className="text-[13px] font-medium opacity-80">/ 5 · {band.label}</span>
      </div>
    );
  }

  return (
    <span
      className={`tnum inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}
      title={`Condition grade ${grade.toFixed(1)} of 5 — ${band.label}`}
    >
      {grade.toFixed(1)}
      <span className="font-normal opacity-70">/5</span>
    </span>
  );
}

export function TitleBadge({ status }: { status: string }) {
  if (status === "clean") return null;
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-warn-soft text-warn">
      {status}
    </span>
  );
}

export function ReserveBadge({
  hasReserve,
  met,
  hasBid,
}: {
  hasReserve: boolean;
  met: boolean;
  hasBid: boolean;
}) {
  if (!hasReserve) {
    return <span className="text-[12px] font-medium text-good">No reserve</span>;
  }
  if (met) {
    return <span className="text-[12px] font-medium text-good">Reserve met</span>;
  }
  return (
    <span className="text-[12px] font-medium text-ink-faint">
      {hasBid ? "Reserve not met" : "Reserve set"}
    </span>
  );
}
