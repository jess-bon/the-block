"use client";

import { useEffect, useState } from "react";
import { formatCountdown, type AuctionState } from "@/lib/auction";

export function Countdown({
  endsAt,
  startsAt,
  state,
  className = "",
}: {
  endsAt: string;
  startsAt: string;
  state: AuctionState;
  className?: string;
}) {
  const target = state === "upcoming" ? startsAt : endsAt;
  const [remaining, setRemaining] = useState(() => new Date(target).getTime() - Date.now());

  useEffect(() => {
    if (state === "ended") return;

    const compute = () => new Date(target).getTime() - Date.now();
    setRemaining(compute());

    const urgent = compute() < 3_600_000;
    const interval = setInterval(() => setRemaining(compute()), urgent ? 1_000 : 30_000);
    return () => clearInterval(interval);
  }, [target, state]);

  if (state === "ended") {
    return <span className={`tnum ${className}`}>Closed</span>;
  }

  const urgent = state === "live" && remaining < 3_600_000;

  return (
    <span className={`tnum ${urgent ? "text-warn" : ""} ${className}`}>
      {state === "upcoming" ? "Opens in " : ""}
      {formatCountdown(remaining)}
      {state === "live" ? " left" : ""}
    </span>
  );
}
