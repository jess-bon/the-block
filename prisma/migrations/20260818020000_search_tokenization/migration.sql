-- Fixes hyphenated model names in the search vector.
--
-- Postgres' 'simple' parser tokenizes "F-150" as 'f' + '-150' — it reads the
-- hyphen as a sign and keeps it on the number. Application-side tokenizing
-- produces 'f' + '150', so the two never met and searching "f-150" fell all
-- the way through to the fuzzy fallback, which returned every Ford.
--
-- Rather than trying to mirror Postgres' parser in JavaScript, we index each
-- hyphenated field three ways: as written, with hyphens as spaces, and with
-- hyphens removed. "F-150" then contributes 'f', '-150', '150' and 'f150', so
-- "f-150", "f 150" and "f150" all hit. This matters across the dataset —
-- CX-5, CR-V, F-150, Golf GTI, 3 Series and Model 3 are all affected.
--
-- A generated column's expression cannot be altered in place, so the column
-- and its index are dropped and rebuilt.

DROP INDEX IF EXISTS "Vehicle_searchVector_idx";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "Vehicle"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    -- Weight A: what people actually search for, in all three normalizations.
    setweight(
      to_tsvector('simple',
        coalesce("make", '') || ' ' ||
        coalesce("model", '') || ' ' ||
        replace(coalesce("model", ''), '-', ' ') || ' ' ||
        replace(coalesce("model", ''), '-', '') || ' ' ||
        coalesce("trim", '') || ' ' ||
        replace(coalesce("trim", ''), '-', ' ') || ' ' ||
        replace(coalesce("trim", ''), '-', '')
      ), 'A') ||
    -- Weight B: narrowing attributes.
    setweight(
      to_tsvector('simple',
        coalesce("year"::text, '') || ' ' || coalesce("bodyStyle", '') || ' ' ||
        coalesce("fuelType", '') || ' ' || coalesce("drivetrain", '') || ' ' ||
        coalesce("transmission", '')
      ), 'B') ||
    -- Weight C: identifiers and context. A match here must never outrank a
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
