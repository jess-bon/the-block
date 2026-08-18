# The Block

A buyer-side wholesale vehicle auction prototype, built for the OPENLANE coding
challenge. Browse 200 lots, inspect condition and damage, and bid against a real
database with real concurrency handling.

In a hurry? [SUBMISSION.md](SUBMISSION.md) is a five-minute summary with the
key decisions, measured results and technical references. The original challenge
brief is preserved in [CHALLENGE.md](CHALLENGE.md).

---

## How to Run

**Prerequisites:** Node 20+ and a local PostgreSQL 14+ server.

```bash
# 1. Install
npm install

# 2. Create the database, write .env, migrate, and load the 200 vehicles
npm run setup

# 3. Go
npm run dev            # http://localhost:3000
```

`npm run setup` runs [`scripts/init-env.mjs`](scripts/init-env.mjs) first, which
creates the `the_block` database and writes a `.env` pointing at it under your
own Postgres role:

```bash
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/the_block?schema=public"
```

On macOS/Homebrew that username is just your shell user — `whoami` — and the
role needs no password, so nothing else has to be filled in. Both steps are
skipped if they are already done, so an existing `.env` or database is never
touched; write the file yourself if you would rather configure it by hand.

The seed prints a summary so you can confirm it worked:

```
Inserted 200 vehicles
Inserted 833 historical bids
Seed complete: 50 live, 115 upcoming, 35 ended, 88 with bids
```

`npm run seed` is idempotent — it truncates and rebuilds, so re-run it any time
to reset the demo to a clean state after placing test bids.

<details>
<summary>If <code>createdb</code> isn't on your PATH, or you use Docker</summary>

```bash
docker run --name theblock-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=the_block -p 5432:5432 -d postgres:16
```

Then write `.env` yourself before running setup — a password-protected install
needs credentials the generated string won't have:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/the_block?schema=public"
```

`npm run setup` leaves any existing `.env` alone, and skips database creation
when `createdb` isn't on the PATH, so it is safe to run afterwards.
</details>

### Other scripts

| Command | What it does |
|---|---|
| `npm run seed` | Reset inventory and bid history to a clean state |
| `npm run setup` | Create the database and `.env` if missing, migrate, then seed |
| `npm run studio` | Prisma Studio — browse the database |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |

---

## Time Spent

About 4.5 hours across two sessions.

The first ~3 hours covered the brief, dataset profiling, schema, seeding, the
bid transaction and the two main screens. A second pass added the welcome page
and replaced the naive `ILIKE` search with Postgres full-text search, which also
turned up the price-sort bug and the dev-only reserve leak documented below.

I spent the first twenty minutes reading the data rather than writing code, and
that paid for itself — several decisions below came directly out of what the
profiling turned up.

---

## Stack

- **Frontend:** Next.js 15 (App Router, React Server Components), TypeScript, Tailwind v4
- **Backend:** Next.js route handlers — one process, no separate API server
- **Database:** PostgreSQL via Prisma 6

The brief said a frontend-only implementation was acceptable, so the database is
a deliberate addition rather than a requirement. My reasoning is in
[Notable Decisions](#notable-decisions).

---

## What I Built

**Welcome page** (`/`) — a short cover page with the stack, live inventory
counts read from the database, and a link into the demo.

**Inventory browsing** (`/search`) — Postgres full-text search across make,
model, trim, VIN, lot, city and dealership, with trigram-based typo tolerance;
filter by auction state, condition grade, price ceiling, make, body style,
fuel, province and title status, each showing a live count; seven sort orders;
paginated.

All filter state lives in the URL, so every view is linkable and the entire page
renders on the server with no client-side data fetching.

**Vehicle detail** (`/vehicles/[id]`) — photo gallery, full specifications, a
condition panel, selling dealer, live bid panel and bid history.

**Bidding** — price-scaled increments, server-side validation, an append-only
bid ledger, Buy Now, and per-browser bid identity so the UI can show
"you are the high bidder" versus "you have been outbid".

**My bids** (`/my-bids`) — every lot you have bid on, split into leading and
outbid.

---

## Notable Decisions

### Why a database at all

Bids are the one part of this app with genuine server semantics. They have to
persist, they have to be validated against authoritative state, and two bids
arriving at the same price at the same moment must not both win. A `useState`
counter demos identically to this and proves none of it.

The concrete payoff is in [`lib/bidding.ts`](lib/bidding.ts). Every bid runs in
a transaction that opens with `SELECT ... FOR UPDATE` on the vehicle row.
Without that lock, two buyers bidding simultaneously both read the old standing
bid, both pass validation, and both write. With it, the read-validate-write
cycle is serialized per vehicle while bids on every *other* vehicle stay fully
concurrent. A unique constraint on `(vehicleId, amount)` backs it up.

I tested this by firing ten simultaneous identical bids at one lot: one returns
`201`, the other nine come back `422` having correctly seen the new higher
price, and the ledger and the denormalized `currentBid` agree afterwards.

### The auction dates needed normalizing

Every `auction_start` in the dataset falls between 2026-03-31 and 2026-04-06.
Left alone, all 200 lots render as closed and the entire live-auction experience
is dead on arrival. The brief allows normalizing these, so the seed shifts the
whole window as a single unit — preserving the dataset's relative ordering and
hour-of-day — landing it so the window straddles now. That yields ~50 live,
~115 upcoming and ~35 closed lots, enough of each to demo every state.

The dataset has no auction *end* time, so each lot gets a 1–3 day run.

### Reserve prices never leave Postgres

140 lots carry a reserve. Real auction platforms tell you *whether* reserve has
been met but never the number, because publishing it hands every buyer the
seller's walk-away price.

My first cut selected the column and deleted it in JavaScript. That was not
enough: Next's **dev-mode** RSC payload serialized the whole row on the detail
page, so the reserve was sitting in the page source — and only in dev, which
production builds would never have revealed.

So the SQL projection now omits `reservePrice` entirely and has Postgres compute
`hasReserve` and `reserveMet` instead. The number never enters the Node process,
which makes the guarantee structural rather than a convention someone can
forget. Verified against 40 lots in both dev and production, with a positive
control confirming the check can actually detect a leak.

### Search is full-text, not `LIKE`

The first version was an eight-column `ILIKE '%term%'` OR-chain. It could not
use an index, and it failed on any multi-word query — "tesla model 3" and
"ford f-150" both returned **zero** results, because the whole string had to
appear inside a single column.

It is now a weighted `tsvector` generated column with a GIN index. Make, model
and trim carry weight A, attributes B, and identifiers and dealership C, so
`ts_rank` puts actual Fords above the dealership "Parkway Ford". A `pg_trgm`
word-similarity index provides a "did you mean" fallback that runs *only* when
the exact search returns nothing.

Three things that took iteration and are worth knowing:

- Postgres tokenizes `F-150` as `'f'` + `'-150'`, keeping the hyphen on the
  number, while application-side tokenizing gives `'f'` + `'150'`. The two never
  matched. Rather than mirroring Postgres' parser in JavaScript, each hyphenated
  field is indexed three ways — as written, hyphens as spaces, hyphens removed —
  so `f-150`, `f 150` and `f150` all hit. This affects CX-5, CR-V, F-150,
  3 Series and Model 3.
- Only the *last* token gets a `:*` prefix. Prefixing every token made `f-150`
  match all 24 Fords, since `f:*` matches Ford and Forte too.
- The trigram fallback is restricted to single-word queries. Across a whole
  phrase it was far too loose — "ford f-150" scored highly enough against
  "Ford Explorer" to return 16 lots.

### Damage notes are ranked, not listed

The dataset gives damage as an unordered list of free-text strings, so "Flood
damage - electrical issues present" sits at the same visual weight as "Scuff
marks on door sill plates". The detail page classifies each note as structural,
mechanical or cosmetic and leads with the serious ones. A buyer should hit the
disqualifying problems before the trivia.

This is pattern-matching over a known vocabulary, which is honest for a
prototype but is the first thing I would replace with a real severity field.

### Bid identity without authentication

Auth was explicitly not required, but a bid still has to belong to *someone* or
the interface cannot distinguish "you are winning" from "you were outbid" — and
that distinction is most of what makes bidding feel real. Middleware assigns
each browser a random id in a cookie. Setting it server-side means server
components read it during render, so bid state is correct in the first paint
rather than flickering in after hydration.

### Photos do not depend on the network

The dataset's `placehold.co` URLs serve **SVG**, which the Next image optimizer
refuses to process — every photo came back as a broken alt-text box. Rather than
enabling `dangerouslyAllowSVG` for a third-party host, images render through a
small component that falls back to a generated, deterministic panel when a URL
will not load. The app therefore looks correct offline or behind a firewall.

The dark theme is built around `#1a1a2e`, the background colour of the
placeholder images themselves, so 200 placeholders read as intentional.

---

## Assumptions and Scope

**Bidding rules are mine.** The dataset has prices but no rules. I defined:

- Increments scale with price: $100 under $5k, $250 under $20k, $500 under $50k, $1,000 above
- The opening bid on a lot with no bids is the starting bid itself
- Every subsequent bid must clear the standing bid by at least one increment and land on an increment boundary
- Buy Now closes the lot immediately
- Lots that have not opened yet accept **pre-bids**, which carry into the live sale — this mirrors real wholesale proxy bidding and keeps all 200 lots explorable

**Bid history is synthesized.** The dataset gives a `current_bid` and a
`bid_count` but no individual bids, so a detail page would show a price with no
provenance. The seed back-fills a plausible ascending ladder that ends exactly
on the recorded `current_bid`. All seeded randomness uses a fixed PRNG seed, so
re-seeding reproduces the same database.

**Deliberately not built:** authentication, seller and dealer tooling, checkout
or payments, proxy/max bidding, watchlists, real-time push. The first four were
ruled out by the brief. Live push updates were the one real temptation — see
below.

---

## Testing

Manual and API-level, no automated suite — an explicit tradeoff for the timebox.
What I verified:

| | Result |
|---|---|
| Bid below minimum | `422` with the minimum returned |
| Bid off the increment boundary | `422` |
| Valid bid, and valid multi-increment jump | `201`, ledger and denormalized column agree |
| **10 concurrent identical bids** | **exactly 1 accepted, 9 correctly rejected** |
| Buy Now | closes the lot, sets `soldAt`/`soldPrice` |
| Any bid on a sold or closed lot | `409` |
| Non-numeric, fractional, negative amounts | `400` |
| Unknown vehicle id | `404` |
| Inventory, filters, sorts, search, `/my-bids` | `200` |
| Layout at 500px and 1440px | verified by screenshot |
| Multi-word and typo search | see the search table below |
| Reserve price in page source | 0 across a 40-lot sweep in dev (where the leak was); spot-checked in prod |

Search behaviour, measured against the dataset:

| Query | Before | After | Lots that exist |
|---|---|---|---|
| `ford f-150` | 0 | 2 | 2 |
| `tesla model 3` | 0 | 4 | 4 |
| `toronto ford` | 0 | 3 | — |
| `cx-5` | 0 | 10 | 10 |
| `f150` | 0 | 2 | 2 |
| `chevorlet` | 0 | 8 (fuzzy) | 8 Chevrolets |

If I were adding tests, `lib/auction.ts` is pure and framework-free specifically
so it can be unit-tested without a database, and the concurrency check above is
the first thing I would automate.

---

## What I'd Do With More Time

1. **Real-time updates.** The bid panel refreshes the server component after you
   bid, but another buyer's bid does not reach you until you reload. Postgres
   `LISTEN/NOTIFY` into an SSE endpoint is the natural fit and was the hardest
   thing to leave out.
2. **Proxy bidding.** Set a maximum and let the system bid the minimum on your
   behalf. It is how wholesale buyers actually work, and the ledger already
   supports it.
3. **Search relevance tuning.** Full-text and trigram are in place, but there
   are no synonyms — "pickup" does not find "truck", "4x4" does not find "4WD".
   A synonym dictionary is the next step.
4. **A real severity field** on damage, replacing the pattern matching.
5. **Automated tests**, starting with the concurrency case.
6. **Accessibility pass.** Semantics, labels and focus states are in place and
   the filter drawer traps nothing it shouldn't, but I have not run a screen
   reader end to end.

---

## AI Tools

Built with Claude (Claude Code) as a pair. I directed the architecture and
product decisions — the database-versus-local-state call, hiding reserve prices,
ranking damage by severity, the pre-bid model — and used the assistant for
scaffolding, Tailwind, and working through the transaction semantics.

Things it caught that I would have shipped broken: the `placehold.co` SVG
issue; `capitalize` rendering "km" as "Km"; a `price_asc` sort that floated all
112 no-bid lots above every lot with a bid; a duplicate `id="bid-amount"` from
rendering the bid panel twice behind `lg:hidden`; and the dev-only reserve-price
leak, which HTTP checks and the production build both missed.

Two it got wrong and I had to override: an initial mobile-overflow "bug" that
was headless Chrome clamping its window to a 500px minimum rather than a CSS
problem, and a first pass at search that was *less* precise than what it
replaced until the tokenization and fallback rules were pinned down.
