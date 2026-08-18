import type { AuctionState } from "./auction";
import { FILTER_KEYS, SORT_OPTIONS, type SortKey, type VehicleQuery } from "./inventory";

export { FILTER_KEYS };
export type { FilterKey } from "./inventory";

const STATES: (AuctionState | "all" | "open")[] = ["open", "live", "upcoming", "ended", "all"];

/**
 * Filters live entirely in the URL. No client state store, every view is
 * linkable, and the server component reads the query straight off the request —
 * which is what lets the inventory page render on the server with no
 * client-side data fetching.
 */
export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): VehicleQuery {
  const list = (key: string): string[] | undefined => {
    const value = params[key];
    if (value === undefined) return undefined;
    const values = Array.isArray(value) ? value : value.split(",");
    const cleaned = values.map((item) => item.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  };

  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const number = (key: string): number | undefined => {
    const raw = single(key);
    if (raw === undefined || raw === "") return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const rawState = single("state");
  const rawSort = single("sort");

  return {
    q: single("q") || undefined,
    make: list("make"),
    bodyStyle: list("bodyStyle"),
    fuelType: list("fuelType"),
    province: list("province"),
    titleStatus: list("titleStatus"),
    minGrade: number("minGrade"),
    maxPrice: number("maxPrice"),
    state: STATES.includes(rawState as AuctionState) ? (rawState as AuctionState) : "open",
    // Sort is left undefined when absent so findVehicles can default to
    // relevance when there is a search term and ending-soonest when there is not.
    sort: rawSort && rawSort in SORT_OPTIONS ? (rawSort as SortKey) : undefined,
    page: number("page") ?? 1,
  };
}

export function activeFilterCount(query: VehicleQuery): number {
  return (
    FILTER_KEYS.reduce((total, key) => total + (query[key]?.length ?? 0), 0) +
    (query.minGrade !== undefined ? 1 : 0) +
    (query.maxPrice !== undefined ? 1 : 0)
  );
}
