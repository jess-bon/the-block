# The Block — Submission Summary

**Jess Bon** · [jdbon57@gmail.com](mailto:jdbon57@gmail.com)

A five-minute read. Full setup, reasoning and tradeoffs are in the
[README](README.md); the original brief is preserved in [CHALLENGE.md](CHALLENGE.md).
*(This file was the challenge's submission template — now filled in.)*

---

## How to Run

```bash
npm install
createdb the_block
cp .env.example .env      # set DATABASE_URL
npm run setup             # migrate + seed 200 vehicles
npm run dev               # http://localhost:3000
```

Requires Node 20+ and local PostgreSQL 14+. `npm run seed` is idempotent — re-run
it any time to reset the demo after placing test bids.

---

## Time Spent

**~4.5 hours** across two sessions. First ~3 hours: brief, dataset profiling,
schema, seeding, bid transaction, both main screens. Second pass: welcome page,
full-text search, and the cleanup that surfaced three bugs.

---

## Stack

| Layer | Choice |
|---|---|
| **Frontend** | Next.js 15 (App Router, RSC), TypeScript, Tailwind v4 |
| **Backend** | Next.js route handlers — one process, no separate API server |
| **Database** | PostgreSQL 16 via Prisma 6.19 |

The brief said frontend-only was acceptable. The database is a **deliberate
addition**, justified below.

---

## What I Built

| Route | What it does |
|---|---|
| `/` | Cover page — stack, live DB-backed counts, link into the demo |
| `/search` | Full-text search, 7 filter dimensions with live counts, 7 sorts, paginated |
| `/vehicles/[id]` | Gallery, specs, condition panel, dealer, bid panel, bid history |
| `/my-bids` | Every lot you've bid on, split into leading vs outbid |

---

## Notable Decisions

**Why a database.** Bids are the one part of this app with real server
semantics: they must persist, validate against authoritative state, and two
bids at the same price must not both win. A `useState` counter demos identically
and proves none of it. Every bid runs in a transaction opening with
`SELECT … FOR UPDATE` on the vehicle row, backed by a unique constraint on
`(vehicleId, amount)`.

**Auction dates needed normalizing.** Every `auction_start` in the dataset falls
in a week that is now months past — untouched, all 200 lots render as closed.
The seed shifts the whole window as one unit, preserving relative order and
hour-of-day, landing it so the window straddles now.

**Reserve prices never leave Postgres.** The SQL projection omits the column
entirely; Postgres computes `hasReserve` and `reserveMet` instead. Stripping it
in JavaScript was *not* enough — Next's dev-mode RSC payload serialized the whole
row, so the reserve sat in the page source in dev but not in production.

**Damage is ranked, not listed.** Notes are classified structural / mechanical /
cosmetic and shown worst-first, so a flood-damage disclosure doesn't sit at the
same weight as a scuffed door sill.

**Bid identity without auth.** Middleware assigns each browser a cookie id, so
the UI can distinguish "you're winning" from "you were outbid" — most of what
makes bidding feel real — without building accounts.

---

## Search: Before and After

Replaced an eight-column `ILIKE '%term%'` OR-chain with a weighted `tsvector`
generated column (GIN indexed), `ts_rank` relevance, and a `pg_trgm` typo
fallback. The old version couldn't use an index and **failed on every multi-word
query**:

| Query | Before | After | Actually exist |
|---|---|---|---|
| `ford f-150` | 0 | **2** | 2 |
| `tesla model 3` | 0 | **4** | 4 |
| `cx-5` | 0 | **10** | 10 |
| `crv` | 0 | **3** | 3 |
| `f150` | 0 | **2** | 2 |
| `toronto ford` | 0 | **3** | — |
| `chevorlet` | 0 | **8** (fuzzy) | 8 Chevrolets |

Three things needed iteration: Postgres tokenizes `F-150` as `'f'` + `'-150'`
(hyphen kept on the number) so hyphenated fields are indexed three ways;
prefixing every token made `f-150` match all 24 Fords, so only the last token
gets `:*`; and the trigram fallback was far too loose as a parallel `OR`, so it
now fires only on zero results and only for single words.

---

## Testing

Manual and API-level, no automated suite — an explicit timebox tradeoff.

| Check | Result |
|---|---|
| **10 concurrent identical bids** | **1 accepted, 9 correctly rejected**; ledger and denormalized column agree |
| Bid below minimum / off-increment | `422` with the minimum returned |
| Buy Now | Closes the lot, sets `soldAt` / `soldPrice` |
| Bid on sold or closed lot | `409` |
| Non-numeric, fractional, negative | `400` · unknown id `404` |
| **9 SQL-injection / malformed inputs** | All `200`, no errors, table intact |
| Reserve price in page source | **0** across a 40-lot sweep in dev (where the leak was); spot-checked in prod |
| Fresh-clone setup from README | Verified on a throwaway database |
| Layout at 500px and 1440px | Verified by screenshot |

Bugs this surfaced that HTTP checks alone missed: a client-bundle crash on
`/search` (Prisma's `sqltag` pulled into the browser — SSR returned 200, it threw
on hydration), the dev-only reserve leak, a `price_asc` sort that floated all 112
no-bid lots above every lot with a bid, and a duplicate `id="bid-amount"` from
rendering the bid panel twice.

---

## Technical References

Sources consulted, and what each one settled:

| Source | What it decided |
|---|---|
| [Prisma — Full-text search](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) | Built-in FTS is a **preview** feature (`fullTextSearchPostgres`), works on `String` fields, builds `to_tsvector` at query time — so it can't use a GIN index |
| [prisma/prisma#27186](https://github.com/prisma/prisma/issues/27186) | The `search` operator is **not available** on `Unsupported("tsvector")` fields — Prisma's FTS structurally cannot read our generated column |
| [Prisma — You don't need Elasticsearch](https://www.prisma.io/blog/you-dont-need-elasticsearch-postgres-already-has-full-text-search) | Prisma's own recommendation is `tsvector` + GIN + `ts_rank` — which is what we built, via raw SQL |
| [Prisma — Raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) | `$queryRaw` tagged templates → prepared statements; `Prisma.sql` / `Prisma.join` / `Prisma.empty` are the documented composition helpers |
| [Prisma — Raw queries (`Prisma.raw` warning)](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) | `Prisma.raw` with user input is *"vulnerable ❌ to SQL Injection"*; identifiers must come from a hardcoded allowlist — ours does, at exactly 2 call sites |
| [Prisma — TypedSQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql) | The typed alternative to `$queryRaw`; rejected because our `WHERE` / `ORDER BY` are composed dynamically. See limitations below |
| [Prisma — Config reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference) | `prisma.config.ts` disables `.env` auto-loading, which broke setup — so the seed config stays in `package.json` for this Prisma 6 project |
| [PostgreSQL — pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) | `<%` takes the search word on the left; the `%>` commutator puts the indexed expression on the left so the GIN index is usable. Threshold set to `0.4` on the database, since the `0.6` default matched no real typos |
| [PostgreSQL — Text search controls](https://www.postgresql.org/docs/current/textsearch-controls.html) | `setweight` A/B/C ranking, so an actual Ford outranks the dealership "Parkway Ford" |

---

## Known Limitations

- **`$queryRaw` type parameters are assertions, not checks.** If the SQL
  projection and the TypeScript type drift, the compiler won't catch it.
  TypedSQL would fix this but doesn't suit dynamically composed queries.
- **No synonyms in search** — "pickup" doesn't find "truck", "4x4" doesn't find
  "4WD". A synonym dictionary is the next step.
- **No real-time updates.** Another buyer's bid doesn't reach you until reload.
  Postgres `LISTEN/NOTIFY` into SSE is the natural fit and was the hardest thing
  to cut.
- **Pinned to Prisma 6** (6.19.3; latest stable is 7.9.1). Prisma 7 moves the
  connection URL into `prisma.config.ts` and requires a driver adapter — a real
  migration through the layer everything else depends on, which I wasn't going
  to do untested at the end of a timebox. `prisma validate` passes, and
  `.vscode/settings.json` pins the language server so the editor agrees with the
  code rather than flagging `datasource.url`.

---

## What I'd Do With More Time

1. Real-time bid updates via `LISTEN/NOTIFY` → SSE
2. Proxy bidding — set a max, system bids the minimum on your behalf
3. Automated tests, starting with the concurrency case
4. A real severity field on damage, replacing the pattern matching
5. Full accessibility pass with a screen reader
