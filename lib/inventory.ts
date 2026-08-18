export const SORT_OPTIONS = {
  relevance: "Best match",
  ending_soon: "Ending soonest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  grade_desc: "Condition: best first",
  odometer_asc: "Odometer: lowest",
  year_desc: "Year: newest",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export const FILTER_KEYS = ["make", "bodyStyle", "fuelType", "province", "titleStatus"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type AuctionStateFilter = "live" | "upcoming" | "ended" | "all" | "open";

export type VehicleQuery = {
  q?: string;
  make?: string[];
  bodyStyle?: string[];
  fuelType?: string[];
  province?: string[];
  titleStatus?: string[];
  minGrade?: number;
  maxPrice?: number;
  state?: AuctionStateFilter;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

export type Facet = { value: string; count: number };
export type Facets = Record<FilterKey, Facet[]>;

export type SearchMode = "none" | "fts" | "fuzzy";
