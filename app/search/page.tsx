import { cookies } from "next/headers";
import { findVehicles, getBidderPositions, getFacets } from "@/lib/vehicles";
import { activeFilterCount, parseSearchParams } from "@/lib/searchParams";
import { BIDDER_COOKIE } from "@/lib/session";
import { InventoryControls } from "@/components/InventoryControls";
import { VehicleCard } from "@/components/VehicleCard";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inventory — The Block" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseSearchParams(params);

  const cookieStore = await cookies();
  const bidderId = cookieStore.get(BIDDER_COOKIE)?.value;

  const { vehicles, total, page, pageCount, searchMode } = await findVehicles(query);
  const facets = await getFacets(query, searchMode);

  const positions = bidderId
    ? await getBidderPositions(
        bidderId,
        vehicles.map((vehicle) => vehicle.id),
      )
    : new Map<string, number>();

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">Inventory</h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Wholesale lots open for bidding. Prices in CAD.
        </p>
      </div>

      <InventoryControls facets={facets} total={total} activeCount={activeFilterCount(query)}>
        {vehicles.length === 0 ? (
          <EmptyState searched={Boolean(query.q)} />
        ) : (
          <>
            {searchMode === "fuzzy" && (
              <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent">
                No exact matches for “{query.q}”. Showing closest results.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  position={positions.get(vehicle.id)}
                />
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} searchParams={params} />
          </>
        )}
      </InventoryControls>
    </div>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong px-6 py-16 text-center">
      <p className="text-[15px] font-semibold">No lots match</p>
      <p className="mt-1.5 text-[13.5px] text-ink-muted">
        {searched
          ? "Try a broader search, or clear a filter."
          : "Try widening the condition grade or clearing a make."}
      </p>
    </div>
  );
}
