import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Block — Wholesale Vehicle Auction",
  description: "Browse, inspect and bid on wholesale vehicle inventory.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded bg-accent text-[13px] font-bold text-canvas"
              >
                B
              </span>
              <span className="text-[15px] font-semibold tracking-tight">The Block</span>
            </Link>
            <span className="hidden text-[13px] text-ink-faint sm:block">
              Wholesale vehicle auction
            </span>
            <nav className="ml-auto flex items-center gap-1">
              <Link
                href="/search"
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Inventory
              </Link>
              <Link
                href="/my-bids"
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                My bids
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-16 border-t border-hairline">
          <div className="mx-auto max-w-[1400px] px-4 py-6 text-[12px] text-ink-faint sm:px-6">
            Prototype built for the OPENLANE challenge. Synthetic inventory — no real
            vehicles, bids or transactions.
          </div>
        </footer>
      </body>
    </html>
  );
}
