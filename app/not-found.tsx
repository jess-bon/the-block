import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="tnum text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
        404
      </p>
      <h1 className="mt-2 text-[22px] font-bold tracking-tight">Lot not found</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
        This lot may have been withdrawn, or the link may be wrong.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        Browse inventory
      </Link>
    </div>
  );
}
