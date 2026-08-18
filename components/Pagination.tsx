import Link from "next/link";

export function Pagination({
  page,
  pageCount,
  searchParams,
}: {
  page: number;
  pageCount: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      params.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/search?${query}` : "/search";
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-2 text-[13px]"
    >
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
        Previous
      </PageLink>
      <span className="tnum px-3 text-ink-muted">
        Page {page} of {pageCount}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount}>
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-hairline px-3 py-1.5 font-medium text-ink-faint opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll
      className="rounded-lg border border-hairline bg-surface px-3 py-1.5 font-medium transition-colors hover:border-hairline-strong"
    >
      {children}
    </Link>
  );
}
