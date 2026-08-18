import { cache } from "react";
import { Prisma, type Vehicle } from "@prisma/client";
import { prisma } from "./db";
import { auctionState, type AuctionState } from "./auction";
import {
  FILTER_KEYS,
  type FilterKey,
  type VehicleQuery,
  type SortKey,
  type Facets,
  type SearchMode,
} from "./inventory";

// Deliberately NOT re-exported from here: SORT_OPTIONS, FILTER_KEYS, VehicleQuery,
// Facets and friends all live in ./inventory and must be imported from there.
// This module imports @prisma/client and builds Prisma.sql at module scope, so
// any client component that pulls a *value* out of it drags Prisma's sqltag
// into the browser bundle and throws on hydration. Keeping the barrel closed
// makes that boundary enforceable instead of a thing to remember.

/** Column each filter dimension maps to. The whitelist is what makes it safe to
 *  interpolate these as identifiers into raw SQL. */
const FILTER_COLUMNS: Record<FilterKey, string> = {
  make: "make",
  bodyStyle: "bodyStyle",
  fuelType: "fuelType",
  province: "province",
  titleStatus: "titleStatus",
};

export type ClientVehicle = Omit<Vehicle, "reservePrice"> & {
  hasReserve: boolean;
  reserveMet: boolean;
  state: AuctionState;
};

/**
 * Columns selected by the raw queries.
 *
 * Two things are deliberate here.
 *
 * Columns are listed rather than `v.*` so the generated tsvector — large and
 * useless to the app — never gets serialized out of Postgres.
 *
 * And `reservePrice` is absent. Reserve is the seller's confidential
 * walk-away price; the two facts a buyer is entitled to are whether a reserve
 * exists and whether it has been met, so Postgres computes those and the
 * number itself never enters the Node process. Stripping it in JavaScript
 * afterwards was not enough: Next's dev-mode RSC payload serialized the whole
 * row on the detail page, putting the reserve in the page source. Production
 * builds did not, which is exactly the kind of difference that survives review.
 */
const VEHICLE_COLUMNS = Prisma.sql`
  v."id", v."vin", v."lot", v."year", v."make", v."model", v."trim",
  v."bodyStyle", v."exteriorColor", v."interiorColor", v."engine",
  v."transmission", v."drivetrain", v."odometerKm", v."fuelType",
  v."conditionGrade", v."conditionReport", v."damageNotes", v."titleStatus",
  v."province", v."city", v."sellingDealership", v."images",
  v."auctionStart", v."auctionEnd", v."startingBid",
  v."buyNowPrice", v."currentBid", v."bidCount", v."soldAt", v."soldPrice",
  (v."reservePrice" IS NOT NULL) AS "hasReserve",
  (
    v."reservePrice" IS NULL
    OR (v."currentBid" IS NOT NULL AND v."currentBid" >= v."reservePrice")
  ) AS "reserveMet"
`;

/** A row as it comes back from the projection above — already reserve-safe. */
type SafeVehicleRow = Omit<Vehicle, "reservePrice"> & {
  hasReserve: boolean;
  reserveMet: boolean;
};

function rowToClientVehicle(row: SafeVehicleRow, now: Date): ClientVehicle {
  return { ...row, state: auctionState(row, now) };
}

/**
 * Turns raw user input into a tsquery.
 *
 * Punctuation is stripped rather than escaped, because to_tsquery's operator
 * syntax would otherwise throw on input like "f-150" or "4x4!". Tokens are
 * AND-ed so "tesla model 3" narrows instead of widening.
 *
 * Only the *last* token gets the :* prefix operator — that is the one the user
 * may still be typing. Prefixing every token is far too loose: "f-150" splits
 * into "f" and "150", and "f:*" alone matches Ford, Forte and every other
 * f-word, so the query returned all 24 Fords instead of the two F-150s.
 */
function toTsQuery(term: string): string | null {
  const tokens = term.toLowerCase().match(/[a-z0-9]+/g);
  if (!tokens?.length) return null;
  return tokens
    .map((token, index) => (index === tokens.length - 1 ? `${token}:*` : token))
    .join(" & ");
}


/**
 * Builds the WHERE conditions.
 *
 * `excludeDimension` drops one filter from the set. Facet counts use it: the
 * count shown next to "Ford" must be computed with every filter applied
 * *except* the make filter itself, otherwise selecting Ford would collapse
 * every other make's count to zero and you could never widen the selection.
 */
function buildConditions(
  query: VehicleQuery,
  now: Date,
  searchMode: SearchMode,
  excludeDimension?: FilterKey,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  switch (query.state ?? "open") {
    case "live":
      conditions.push(
        Prisma.sql`v."soldAt" IS NULL AND v."auctionStart" <= ${now} AND v."auctionEnd" > ${now}`,
      );
      break;
    case "upcoming":
      conditions.push(Prisma.sql`v."soldAt" IS NULL AND v."auctionStart" > ${now}`);
      break;
    case "ended":
      conditions.push(Prisma.sql`(v."soldAt" IS NOT NULL OR v."auctionEnd" <= ${now})`);
      break;
    case "all":
      break;
    default:
      // "open" — everything a buyer can still act on. The default view, because
      // leading with closed lots would bury the actionable inventory.
      conditions.push(Prisma.sql`v."soldAt" IS NULL AND v."auctionEnd" > ${now}`);
  }

  const term = query.q?.trim();
  const tsQuery = term ? toTsQuery(term) : null;

  if (term && tsQuery && searchMode === "fts") {
    conditions.push(Prisma.sql`v."searchVector" @@ to_tsquery('simple', ${tsQuery})`);
  } else if (term && searchMode === "fuzzy") {
    // Trigram fallback, used only when full-text found nothing. Running it as
    // an OR alongside FTS was far too permissive — "ford f-150" pulled in 16
    // lots because "Ford Explorer" is similar enough to the whole phrase.
    //
    // The %> form (not <%) puts the indexed expression on the left so the GIN
    // trigram index is usable; the two are commutators and match identically.
    // The threshold comes from pg_trgm.word_similarity_threshold, set to 0.4
    // on the database by the add_search migration.
    conditions.push(Prisma.sql`(v."make" || ' ' || v."model") %> ${term}`);
  }

  for (const key of FILTER_KEYS) {
    if (key === excludeDimension) continue;
    const values = query[key];
    if (!values?.length) continue;
    conditions.push(
      Prisma.sql`v.${Prisma.raw(`"${FILTER_COLUMNS[key]}"`)} = ANY(${values}::text[])`,
    );
  }

  if (query.minGrade !== undefined) {
    conditions.push(Prisma.sql`v."conditionGrade" >= ${query.minGrade}`);
  }

  if (query.maxPrice !== undefined) {
    conditions.push(
      Prisma.sql`COALESCE(v."currentBid", v."startingBid") <= ${query.maxPrice}`,
    );
  }

  return conditions;
}

function whereClause(conditions: Prisma.Sql[]): Prisma.Sql {
  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

/**
 * ORDER BY, from a whitelist — sort keys are never interpolated as user input.
 *
 * price sorts use COALESCE(currentBid, startingBid), the amount a buyer would
 * actually pay next. Ordering on currentBid alone floated all 112 no-bid lots
 * above every lot that had a bid, so a $3,500 standing bid sorted behind a
 * $49,000 opening price, and the sort disagreed with the maxPrice filter.
 *
 * Every clause ends with v."id" as a tiebreaker, and that is not cosmetic.
 * None of the sort columns are unique — sorting by year puts 22 lots on the
 * same value, and 4 of the 6 tie groups straddle a 24-row page boundary. SQL
 * does not guarantee a stable order within ties, so without a unique final key
 * Postgres may order tied rows differently between two requests, and paging
 * would silently skip or repeat lots. The id makes the ordering total.
 */
function orderByClause(sort: SortKey, tsQuery: string | null): Prisma.Sql {
  switch (sort) {
    case "relevance":
      if (!tsQuery) return Prisma.sql`v."auctionEnd" ASC, v."id" ASC`;
      return Prisma.sql`ts_rank(v."searchVector", to_tsquery('simple', ${tsQuery})) DESC, v."auctionEnd" ASC, v."id" ASC`;
    case "price_asc":
      return Prisma.sql`COALESCE(v."currentBid", v."startingBid") ASC, v."id" ASC`;
    case "price_desc":
      return Prisma.sql`COALESCE(v."currentBid", v."startingBid") DESC, v."id" ASC`;
    case "grade_desc":
      return Prisma.sql`v."conditionGrade" DESC, v."id" ASC`;
    case "odometer_asc":
      return Prisma.sql`v."odometerKm" ASC, v."id" ASC`;
    case "year_desc":
      return Prisma.sql`v."year" DESC, v."id" ASC`;
    default:
      return Prisma.sql`v."auctionEnd" ASC, v."id" ASC`;
  }
}

type VehicleRow = SafeVehicleRow & { totalCount: number };

export async function findVehicles(query: VehicleQuery) {
  const now = new Date();
  const perPage = query.perPage ?? 24;
  const page = Math.max(1, query.page ?? 1);
  const term = query.q?.trim();
  const tsQuery = term ? toTsQuery(term) : null;

  // Relevance only means something with a search term behind it.
  const sort: SortKey = query.sort ?? (tsQuery ? "relevance" : "ending_soon");

  const run = async (mode: SearchMode) => {
    // count(*) OVER() returns the total for the whole filtered set alongside
    // the page, so pagination costs one round trip instead of a findMany plus
    // a separate count with a duplicated WHERE.
    const rows = await prisma.$queryRaw<VehicleRow[]>`
      SELECT ${VEHICLE_COLUMNS}, count(*) OVER()::int AS "totalCount"
      FROM "Vehicle" v
      ${whereClause(buildConditions(query, now, mode))}
      ORDER BY ${orderByClause(mode === "fuzzy" ? "ending_soon" : sort, tsQuery)}
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `;
    return { rows, total: rows[0]?.totalCount ?? 0 };
  };

  let mode: SearchMode = tsQuery ? "fts" : "none";
  let { rows, total } = await run(mode);

  // Only reach for fuzzy matching when the exact search found nothing, and
  // only for a single word. This is the "did you mean" path — it costs a
  // second query on a miss and keeps precision intact on the common hit.
  //
  // Restricted to one token because trigram similarity over a whole phrase is
  // far too loose: "ford f-150" scored highly enough against "Ford Explorer"
  // to return 16 lots. Typos are a single-word problem; a multi-word query
  // that matches nothing is better answered with nothing.
  const isSingleToken = Boolean(term) && !/\s/.test(term!);

  if (total === 0 && term && isSingleToken && mode === "fts") {
    mode = "fuzzy";
    ({ rows, total } = await run(mode));
  }

  return {
    vehicles: rows.map((row) => rowToClientVehicle(row, now)),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    /** Whether results came from an exact or a corrected-spelling match. */
    searchMode: mode,
  };
}


/**
 * Option counts for each filter dimension, computed under the *other* active
 * filters.
 *
 * Previously this returned every distinct value in the table regardless of the
 * query, so the sidebar offered makes that would return nothing and gave no
 * indication of how many lots were behind any option.
 *
 * Values with a zero count drop out of the GROUP BY entirely; a currently
 * selected value is added back at zero so it stays visible and de-selectable.
 */
export async function getFacets(
  query: VehicleQuery,
  /** Must match the mode findVehicles resolved to, or counts contradict results. */
  searchMode: SearchMode = "fts",
): Promise<Facets> {
  const now = new Date();

  const results = await Promise.all(
    FILTER_KEYS.map(async (key) => {
      const column = Prisma.raw(`"${FILTER_COLUMNS[key]}"`);
      const conditions = buildConditions(query, now, searchMode, key);

      const rows = await prisma.$queryRaw<{ value: string; count: number }[]>`
        SELECT v.${column} AS value, count(*)::int AS count
        FROM "Vehicle" v
        ${whereClause(conditions)}
        GROUP BY v.${column}
        ORDER BY v.${column} ASC
      `;

      const seen = new Set(rows.map((row) => row.value));
      for (const selected of query[key] ?? []) {
        if (!seen.has(selected)) rows.push({ value: selected, count: 0 });
      }
      rows.sort((a, b) => a.value.localeCompare(b.value));

      return [key, rows] as const;
    }),
  );

  return Object.fromEntries(results) as Facets;
}

/**
 * Wrapped in React's `cache` so the detail page and its `generateMetadata`
 * share one result.
 *
 * RSC automatically de-duplicates `fetch()` within a render pass, but not
 * arbitrary async functions — so calling this from both places issued the two
 * queries twice, four per page view. `cache` memoizes for the lifetime of the
 * request and takes it back to two.
 */
export const getVehicle = cache(async (id: string) => {
  // Independent queries — running them in parallel halves the detail page's
  // database wait. The vehicle goes through the same reserve-safe projection
  // as the list query rather than findUnique, so the reserve price is never
  // materialized here either.
  const [rows, bids] = await Promise.all([
    prisma.$queryRaw<SafeVehicleRow[]>`
      SELECT ${VEHICLE_COLUMNS}
      FROM "Vehicle" v
      WHERE v."id" = ${id}
    `,
    prisma.bid.findMany({
      where: { vehicleId: id },
      orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
  ]);

  const vehicle = rows[0];
  if (!vehicle) return null;
  return { vehicle: rowToClientVehicle(vehicle, new Date()), bids };
});

/**
 * Every lot this browser has bid on, with their highest bid, newest close first.
 *
 * One query. The previous version pulled every bid the browser had ever placed
 * with `include: { vehicle: true }` — unbounded, and the only remaining path
 * that selected `reservePrice` into Node — then reduced to a max per vehicle in
 * JavaScript. Postgres does the aggregation, the projection stays reserve-safe,
 * and `limit` bounds it.
 */
export async function getBidderLots(bidderId: string, limit = 100) {
  const rows = await prisma.$queryRaw<(SafeVehicleRow & { myBid: number })[]>`
    SELECT ${VEHICLE_COLUMNS}, mine."myBid"
    FROM (
      SELECT "vehicleId", MAX("amount")::int AS "myBid"
      FROM "Bid"
      WHERE "bidderId" = ${bidderId}
      GROUP BY "vehicleId"
    ) mine
    JOIN "Vehicle" v ON v."id" = mine."vehicleId"
    ORDER BY v."auctionEnd" ASC, v."id" ASC
    LIMIT ${limit}
  `;

  const now = new Date();
  return rows.map((row) => ({
    myBid: row.myBid,
    vehicle: rowToClientVehicle(row, now),
  }));
}

/**
 * This browser's highest bid per lot, used to render high-bidder and outbid
 * state.
 *
 * Aggregated in Postgres rather than by pulling every bid the browser has ever
 * placed and reducing in JS. `vehicleIds` scopes it to the lots actually on
 * screen, so the inventory grid asks about 24 rows, not the whole history.
 */
export async function getBidderPositions(
  bidderId: string,
  vehicleIds?: string[],
): Promise<Map<string, number>> {
  if (vehicleIds && vehicleIds.length === 0) return new Map();

  const grouped = await prisma.bid.groupBy({
    by: ["vehicleId"],
    where: {
      bidderId,
      ...(vehicleIds ? { vehicleId: { in: vehicleIds } } : {}),
    },
    _max: { amount: true },
  });

  return new Map(
    grouped
      .filter((row) => row._max.amount !== null)
      .map((row) => [row.vehicleId, row._max.amount as number]),
  );
}
