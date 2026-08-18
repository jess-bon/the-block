"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Every page here is `force-dynamic` and reads from Postgres on each request,
 * so the realistic failure is the database being unreachable — a reviewer who
 * starts the app before starting Postgres. Without this file that surfaces as
 * Next's default error screen with a stack trace; with it they get a readable
 * message and a retry that re-runs the server render.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-[22px] font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
        This prototype reads live from Postgres on every request. If you just
        started the app, check that your database is running and that{" "}
        <code className="rounded bg-raised px-1 py-0.5 text-[12.5px]">DATABASE_URL</code> is
        set in <code className="rounded bg-raised px-1 py-0.5 text-[12.5px]">.env</code>.
      </p>
      {error.digest && (
        <p className="tnum mt-3 text-[12px] text-ink-faint">Digest: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
