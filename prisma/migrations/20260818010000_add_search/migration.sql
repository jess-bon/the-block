-- Full-text search for the inventory.
--
-- Replaces an eight-column ILIKE '%term%' OR-chain that could not use an index
-- and, worse, failed on any multi-word query: "tesla model 3" matched nothing,
-- because no single column contains that whole string.
--
-- The tsvector is a GENERATED ALWAYS column, so Postgres maintains it on every
-- insert and update and it can never drift from the row.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Vehicle"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    -- Weight A: what people actually search for.
    setweight(
      to_tsvector('simple',
        coalesce("make", '') || ' ' || coalesce("model", '') || ' ' || coalesce("trim", '')
      ), 'A') ||
    -- Weight B: narrowing attributes.
    setweight(
      to_tsvector('simple',
        coalesce("year"::text, '') || ' ' || coalesce("bodyStyle", '') || ' ' ||
        coalesce("fuelType", '') || ' ' || coalesce("drivetrain", '') || ' ' ||
        coalesce("transmission", '')
      ), 'B') ||
    -- Weight C: identifiers and context. A match here should never outrank a
    -- make/model match — this is what stops a search for "ford" ranking the
    -- dealership "Parkway Ford" alongside actual Fords.
    setweight(
      to_tsvector('simple',
        coalesce("city", '') || ' ' || coalesce("province", '') || ' ' ||
        coalesce("sellingDealership", '') || ' ' || coalesce("lot", '') || ' ' ||
        coalesce("vin", '') || ' ' || coalesce("exteriorColor", '') || ' ' ||
        coalesce("engine", '')
      ), 'C')
  ) STORED;

CREATE INDEX "Vehicle_searchVector_idx" ON "Vehicle" USING GIN ("searchVector");

-- Trigram index backing typo tolerance ("chevorlet" -> Chevrolet). Only over
-- make+model: those are the names buyers misspell, and a trigram index over
-- every text column would cost far more to maintain than it returns.
CREATE INDEX "Vehicle_makeModel_trgm_idx" ON "Vehicle"
  USING GIN ((("make" || ' ' || "model")) gin_trgm_ops);

-- The default inventory view filters on exactly these two columns together.
CREATE INDEX "Vehicle_open_idx" ON "Vehicle" ("soldAt", "auctionEnd");

-- The %> operator compares against pg_trgm.word_similarity_threshold, which
-- defaults to 0.6 — strict enough that "chevorlet" (0.43 against "Chevrolet
-- Equinox") matches nothing. 0.4 catches real typos without pulling in noise.
--
-- Set on the database rather than per session: Prisma pools connections, so a
-- SET issued on one connection would not apply to the next query.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET pg_trgm.word_similarity_threshold = 0.4',
    current_database()
  );
END
$$;
