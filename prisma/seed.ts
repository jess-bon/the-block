/**
 * Seeds Postgres from data/vehicles.json.
 *
 * Two things happen here that the raw dataset does not give us:
 *
 * 1. Auction times are normalized. Every auction_start in the shipped file
 *    falls in a one-week window that is now months in the past, so untouched
 *    the entire inventory renders as "ended". The README explicitly allows
 *    normalizing these relative to now. We shift the whole window as a unit so
 *    the dataset's relative ordering and hour-of-day survive, landing it so
 *    that roughly a third of lots have ended, a fifth are live, and the rest
 *    are upcoming — enough of each to demo every state.
 *
 * 2. Bid history is synthesized. The dataset gives a current_bid and a
 *    bid_count but no individual bids, so a detail page would show a price
 *    with no provenance. We back-fill a plausible ascending ladder that ends
 *    exactly on the recorded current_bid, then recompute the denormalized
 *    columns from the ledger so the two can't disagree.
 *
 * Everything random here runs off a fixed-seed PRNG, so re-seeding reproduces
 * the same database byte for byte.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { bidIncrement } from "../lib/auction.js";

const prisma = new PrismaClient();

type RawVehicle = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string;
  exterior_color: string;
  interior_color: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  odometer_km: number;
  fuel_type: string;
  condition_grade: number;
  condition_report: string;
  damage_notes: string[];
  title_status: string;
  province: string;
  city: string;
  auction_start: string;
  starting_bid: number;
  reserve_price: number | null;
  buy_now_price: number | null;
  images: string[];
  selling_dealership: string;
  lot: string;
  current_bid: number | null;
  bid_count: number;
};

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1337);

function randInt(min: number, max: number): number {
  return Math.floor(min + rand() * (max - min + 1));
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Builds an ascending ladder of `count` distinct bid amounts that opens at
 * `startingBid` and closes exactly on `currentBid`.
 *
 * Amounts must be distinct because the ledger has a unique constraint on
 * (vehicleId, amount), so we walk upward and force strict monotonicity rather
 * than trusting the interpolation to produce unique values.
 */
function buildBidLadder(startingBid: number, currentBid: number, count: number): number[] {
  if (count <= 1) return [currentBid];

  const amounts: number[] = [];
  let previous = 0;

  for (let index = 0; index < count - 1; index += 1) {
    const progress = index / (count - 1);
    // Ease the ladder so early bids cluster low and the price accelerates near
    // the close, which is how contested lots actually behave.
    const eased = Math.pow(progress, 1.6);
    const raw = startingBid + (currentBid - startingBid) * eased;
    let amount = Math.round(raw / 50) * 50;

    if (amount <= previous) amount = previous + 50;
    if (amount >= currentBid) break;

    amounts.push(amount);
    previous = amount;
  }

  amounts.push(currentBid);
  return amounts;
}

function alias(seedValue: number): string {
  return `Bidder ${1000 + (seedValue % 9000)}`;
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const dataPath = resolve(scriptDir, "../data/vehicles.json");
  const raw = JSON.parse(readFileSync(dataPath, "utf8")) as RawVehicle[];

  console.log(`Read ${raw.length} vehicles from data/vehicles.json`);

  // --- 1. Normalize the auction window onto "now" --------------------------
  const now = Date.now();
  const datasetStarts = raw.map((vehicle) => new Date(vehicle.auction_start).getTime());
  const datasetEarliest = Math.min(...datasetStarts);
  // Land the earliest lot three days back so the window straddles now.
  const shift = now - 3 * DAY - datasetEarliest;

  await prisma.bid.deleteMany();
  await prisma.vehicle.deleteMany();

  const vehicleRows = raw.map((vehicle) => {
    const auctionStart = new Date(new Date(vehicle.auction_start).getTime() + shift);
    // The dataset has no end time, so each lot runs a 1–3 day window.
    const auctionEnd = new Date(auctionStart.getTime() + randInt(24, 72) * HOUR);

    return {
      id: vehicle.id,
      vin: vehicle.vin,
      lot: vehicle.lot,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      bodyStyle: vehicle.body_style,
      exteriorColor: vehicle.exterior_color,
      interiorColor: vehicle.interior_color,
      engine: vehicle.engine,
      transmission: vehicle.transmission,
      drivetrain: vehicle.drivetrain,
      odometerKm: vehicle.odometer_km,
      fuelType: vehicle.fuel_type,
      conditionGrade: vehicle.condition_grade,
      conditionReport: vehicle.condition_report,
      damageNotes: vehicle.damage_notes,
      titleStatus: vehicle.title_status,
      province: vehicle.province,
      city: vehicle.city,
      sellingDealership: vehicle.selling_dealership,
      images: vehicle.images,
      auctionStart,
      auctionEnd,
      startingBid: vehicle.starting_bid,
      reservePrice: vehicle.reserve_price,
      buyNowPrice: vehicle.buy_now_price,
      currentBid: null as number | null,
      bidCount: 0,
    };
  });

  await prisma.vehicle.createMany({ data: vehicleRows });
  console.log(`Inserted ${vehicleRows.length} vehicles`);

  // --- 2. Back-fill bid history -------------------------------------------
  const bidRows: {
    vehicleId: string;
    amount: number;
    bidderId: string;
    alias: string;
    kind: string;
    createdAt: Date;
  }[] = [];

  for (const [index, vehicle] of raw.entries()) {
    if (vehicle.current_bid === null || vehicle.bid_count === 0) continue;

    const row = vehicleRows[index];
    const ladder = buildBidLadder(vehicle.starting_bid, vehicle.current_bid, vehicle.bid_count);

    // Bids land between the moment the lot opened for bidding and now. Lots
    // whose auction has not started yet still accept pre-bids (see README),
    // so those get a window running back from now instead.
    const windowEnd = Math.min(now, row.auctionEnd.getTime());
    const windowStart = Math.min(row.auctionStart.getTime(), windowEnd - 2 * DAY);
    const span = Math.max(windowEnd - windowStart, HOUR);

    ladder.forEach((amount, ladderIndex) => {
      const progress = (ladderIndex + 1) / (ladder.length + 1);
      const jitter = (rand() - 0.5) * (span / (ladder.length + 2));
      const at = new Date(windowStart + span * progress + jitter);
      const bidderSeed = randInt(0, 999_999);

      bidRows.push({
        vehicleId: vehicle.id,
        amount,
        bidderId: `seed-${bidderSeed}`,
        alias: alias(bidderSeed),
        kind: "bid",
        createdAt: new Date(Math.min(Math.max(at.getTime(), windowStart), windowEnd)),
      });
    });
  }

  await prisma.bid.createMany({ data: bidRows });
  console.log(`Inserted ${bidRows.length} historical bids`);

  // --- 3. Recompute denormalized columns from the ledger -------------------
  const aggregates = await prisma.bid.groupBy({
    by: ["vehicleId"],
    _max: { amount: true },
    _count: { _all: true },
  });

  await Promise.all(
    aggregates.map((aggregate) =>
      prisma.vehicle.update({
        where: { id: aggregate.vehicleId },
        data: {
          currentBid: aggregate._max.amount,
          bidCount: aggregate._count._all,
        },
      }),
    ),
  );

  // --- Summary -------------------------------------------------------------
  const [live, upcoming, ended, withBids] = await Promise.all([
    prisma.vehicle.count({
      where: { auctionStart: { lte: new Date() }, auctionEnd: { gt: new Date() } },
    }),
    prisma.vehicle.count({ where: { auctionStart: { gt: new Date() } } }),
    prisma.vehicle.count({ where: { auctionEnd: { lte: new Date() } } }),
    prisma.vehicle.count({ where: { bidCount: { gt: 0 } } }),
  ]);

  console.log(
    `\nSeed complete: ${live} live, ${upcoming} upcoming, ${ended} ended, ${withBids} with bids`,
  );
  console.log(`Increment check: a $20,000 lot takes ${bidIncrement(20_000)} steps`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
