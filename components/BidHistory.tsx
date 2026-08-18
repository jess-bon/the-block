import { formatMoney } from "@/lib/auction";

type BidRow = {
  id: string;
  amount: number;
  alias: string;
  bidderId: string;
  kind: string;
  createdAt: Date;
};

export function BidHistory({ bids, bidderId }: { bids: BidRow[]; bidderId?: string }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-[15px] font-semibold">Bid history</h2>

      {bids.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-ink-muted">
          No bids yet. The first bid opens at the starting price.
        </p>
      ) : (
        <ol className="mt-4 space-y-0">
          {bids.map((bid, index) => {
            const isMine = bid.bidderId === bidderId;
            return (
              <li
                key={bid.id}
                className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-0"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 flex-none rounded-full ${
                      index === 0 ? "bg-good" : "bg-hairline-strong"
                    }`}
                  />
                  <span
                    className={`truncate text-[13.5px] ${
                      isMine ? "font-semibold text-accent" : "text-ink-muted"
                    }`}
                  >
                    {isMine ? "You" : bid.alias}
                  </span>
                  {bid.kind === "buy_now" && (
                    <span className="flex-none rounded bg-good-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-good">
                      Buy now
                    </span>
                  )}
                  {index === 0 && bid.kind !== "buy_now" && (
                    <span className="flex-none rounded bg-good-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-good">
                      High
                    </span>
                  )}
                </div>
                <div className="flex flex-none items-baseline gap-3">
                  <time
                    dateTime={bid.createdAt.toISOString()}
                    className="tnum text-[12px] text-ink-faint"
                  >
                    {relativeTime(bid.createdAt)}
                  </time>
                  <span className="tnum w-[88px] text-right text-[14px] font-semibold">
                    {formatMoney(bid.amount)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
