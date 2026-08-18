"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { bidIncrement, formatMoney, minimumBid, type AuctionState } from "@/lib/auction";
import { Countdown } from "./Countdown";

type BidPanelVehicle = {
  id: string;
  startingBid: number;
  currentBid: number | null;
  buyNowPrice: number | null;
  bidCount: number;
  hasReserve: boolean;
  reserveMet: boolean;
  state: AuctionState;
  auctionStart: string;
  auctionEnd: string;
  soldPrice: number | null;
};

export function BidPanel({
  vehicle,
  myPosition,
}: {
  vehicle: BidPanelVehicle;
  /** This browser's highest bid on the lot, if any. */
  myPosition: number | null;
}) {
  const router = useRouter();
  const minimum = minimumBid(vehicle);
  const increment = bidIncrement(vehicle.currentBid ?? vehicle.startingBid);

  const [amount, setAmount] = useState(minimum);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "bid" | "buy_now">(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [knownMinimum, setKnownMinimum] = useState(minimum);
  if (knownMinimum !== minimum) {
    setKnownMinimum(minimum);
    setAmount(minimum);
  }

  const closed = vehicle.state === "ended";
  const isHighBidder = myPosition !== null && myPosition === vehicle.currentBid;
  const isOutbid = myPosition !== null && !isHighBidder;

  const quickBids = useMemo(
    () => [minimum, minimum + increment, minimum + increment * 2],
    [minimum, increment],
  );

  async function submit(kind: "bid" | "buy_now") {
    setPending(kind);
    setError(null);
    setFlash(null);

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "buy_now" ? { kind } : { amount, kind }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not place that bid.");
        // A rejection usually means the price moved underneath us. Pull fresh
        // server state so the panel re-renders against the real standing bid.
        if (payload.code === "outbid_race" || payload.code === "below_minimum") {
          router.refresh();
        }
        return;
      }

      setFlash(
        kind === "buy_now"
          ? `Bought at ${formatMoney(payload.amount)}. This lot is now closed.`
          : `Bid placed at ${formatMoney(payload.amount)}.`,
      );
      // The whole page is server-rendered, so refresh() re-runs the query and
      // updates the price, bid count, reserve state and history in one pass.
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  if (closed) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {vehicle.soldPrice !== null ? "Sold" : "Final bid"}
        </p>
        <p className="tnum mt-1 text-[28px] font-bold leading-none">
          {vehicle.currentBid !== null ? formatMoney(vehicle.currentBid) : "No bids"}
        </p>
        <p className="mt-3 text-[13px] text-ink-muted">
          {vehicle.currentBid === null
            ? "This lot closed without a bid and did not sell."
            : vehicle.hasReserve && !vehicle.reserveMet
              ? "Bidding closed below the seller's reserve, so the lot did not sell."
              : "This lot has closed."}
        </p>
        {isHighBidder && vehicle.reserveMet && (
          <p className="mt-3 rounded-lg bg-good-soft px-3 py-2 text-[13px] font-medium text-good">
            You won this lot.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      {/* Standing price */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {vehicle.currentBid !== null ? "Current bid" : "Starting bid"}
          </p>
          <p className="tnum mt-0.5 text-[30px] font-bold leading-none">
            {formatMoney(vehicle.currentBid ?? vehicle.startingBid)}
          </p>
          <p className="mt-1.5 text-[12.5px] text-ink-muted">
            {vehicle.bidCount === 0
              ? "No bids yet"
              : `${vehicle.bidCount} ${vehicle.bidCount === 1 ? "bid" : "bids"}`}
            {" · "}
            {!vehicle.hasReserve ? (
              <span className="text-good">No reserve</span>
            ) : vehicle.reserveMet ? (
              <span className="text-good">Reserve met</span>
            ) : (
              <span>Reserve not met</span>
            )}
          </p>
        </div>
        <Countdown
          state={vehicle.state}
          startsAt={vehicle.auctionStart}
          endsAt={vehicle.auctionEnd}
          className="rounded-lg bg-raised px-2.5 py-1.5 text-[13px] font-semibold"
        />
      </div>

      {/* Your position */}
      {isHighBidder && (
        <p className="mt-4 rounded-lg bg-good-soft px-3 py-2 text-[13px] font-medium text-good">
          You are the high bidder.
        </p>
      )}
      {isOutbid && (
        <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-[13px] font-medium text-warn">
          You have been outbid. Your last bid was {formatMoney(myPosition!)}.
        </p>
      )}

      {vehicle.state === "upcoming" && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent">
          This lot has not opened yet. Pre-bids placed now carry into the live sale.
        </p>
      )}

      {/* Amount */}
      <div className="mt-5">
        <label
          htmlFor="bid-amount"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint"
        >
          Your bid
        </label>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setAmount((value) => Math.max(minimum, value - increment))}
            disabled={amount <= minimum}
            aria-label={`Decrease bid by ${increment} dollars`}
            className="h-11 w-11 flex-none rounded-lg border border-hairline bg-raised text-[18px] font-semibold disabled:opacity-40"
          >
            −
          </button>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-faint">
              $
            </span>
            <input
              id="bid-amount"
              type="number"
              value={amount}
              min={minimum}
              step={increment}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="tnum h-11 w-full rounded-lg border border-hairline bg-raised pl-7 pr-3 text-[16px] font-semibold focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setAmount((value) => value + increment)}
            aria-label={`Increase bid by ${increment} dollars`}
            className="h-11 w-11 flex-none rounded-lg border border-hairline bg-raised text-[18px] font-semibold"
          >
            +
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickBids.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={`tnum rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                amount === value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-hairline text-ink-muted hover:text-ink"
              }`}
            >
              {formatMoney(value)}
            </button>
          ))}
        </div>

        <p className="tnum mt-2 text-[12px] text-ink-faint">
          Minimum {formatMoney(minimum)} · increments of {formatMoney(increment)}
        </p>
      </div>

      {/* Actions */}
      <button
        type="button"
        onClick={() => submit("bid")}
        disabled={pending !== null || amount < minimum}
        className="mt-4 h-11 w-full rounded-lg bg-accent text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending === "bid" ? "Placing bid…" : `Place bid · ${formatMoney(amount)}`}
      </button>

      {vehicle.buyNowPrice !== null && (
        <button
          type="button"
          onClick={() => submit("buy_now")}
          disabled={pending !== null}
          className="mt-2 h-11 w-full rounded-lg border border-hairline-strong bg-raised text-[14px] font-semibold transition-colors hover:border-ink-faint disabled:opacity-50"
        >
          {pending === "buy_now"
            ? "Processing…"
            : `Buy now · ${formatMoney(vehicle.buyNowPrice)}`}
        </button>
      )}

      <div aria-live="polite">
        {error && (
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">{error}</p>
        )}
        {flash && (
          <p className="mt-3 rounded-lg bg-good-soft px-3 py-2 text-[13px] text-good">{flash}</p>
        )}
      </div>

      <p className="mt-4 border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-ink-faint">
        Prototype — bids are recorded in a local database and are not binding.
      </p>
    </div>
  );
}
