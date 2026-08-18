import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Block — Jess Bon",
  description: "A buyer-side wholesale vehicle auction prototype, built for OPENLANE.",
};

const STACK = ["Next.js 15", "TypeScript", "Tailwind v4", "Prisma", "PostgreSQL"];

const HIGHLIGHTS = [
  {
    title: "Bids are transactional",
    body: "Every bid takes a row lock before it validates, so ten buyers bidding the same amount at the same instant produce one winner, not a tie.",
  },
  {
    title: "Reserve prices stay on the server",
    body: "Buyers see whether reserve was met, never the number — publishing it would hand them the seller's walk-away price.",
  },
  {
    title: "Damage is ranked, not listed",
    body: "Structural and mechanical faults are separated from cosmetic wear, so the problems that should stop a bid appear first.",
  },
  {
    title: "Search is full-text",
    body: "A weighted tsvector with trigram fallback, so “tesla model 3” and “chevorlet” both find what you meant.",
  },
];

export default async function WelcomePage() {
  const now = new Date();
  const [lots, live, bids] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({
      where: { soldAt: null, auctionStart: { lte: now }, auctionEnd: { gt: now } },
    }),
    prisma.bid.count(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      {/* Identity */}
      <p className="text-[13px] font-medium text-ink-muted">
        Jess Bon
        <span className="mx-2 text-ink-faint">·</span>
        <a href="mailto:jdbon57@gmail.com" className="text-accent hover:underline">
          jdbon57@gmail.com
        </a>
      </p>

      <h1 className="mt-5 text-[38px] font-bold leading-[1.1] tracking-tight sm:text-[52px]">
        The Block
      </h1>
      <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-muted sm:text-[17px]">
        A buyer-side wholesale vehicle auction prototype, built as a coding challenge for{" "}
        <span className="text-ink">OPENLANE</span>. Browse two hundred lots, inspect condition
        and damage, and bid against a real database.
      </p>

      {/* Call to action */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/search"
          className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Open the demo →
        </Link>
        <Link
          href="/my-bids"
          className="inline-flex h-11 items-center rounded-lg border border-hairline bg-surface px-4 text-[14px] font-medium text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
        >
          My bids
        </Link>
      </div>

      {/* Live stats, read from the database on each request */}
      <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-y border-hairline py-5">
        <Stat label="Lots" value={lots.toLocaleString("en-CA")} />
        <Stat label="Live now" value={live.toLocaleString("en-CA")} />
        <Stat label="Bids placed" value={bids.toLocaleString("en-CA")} />
      </dl>

      {/* Stack */}
      <div className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Stack</h2>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {STACK.map((item) => (
            <li
              key={item}
              className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[12.5px] text-ink-muted"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* What to look at */}
      <div className="mt-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          What to look at
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-xl border border-hairline bg-surface p-4">
              <h3 className="text-[14px] font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-[12.5px] leading-relaxed text-ink-faint">
        Setup instructions, assumptions and the full set of decisions are in the{" "}
        <span className="text-ink-muted">README</span> at the repository root. Inventory is
        synthetic — no real vehicles, bids or transactions.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5 text-[22px] font-bold leading-none">{value}</dd>
    </div>
  );
}
