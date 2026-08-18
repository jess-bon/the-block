import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { auctionState, bidIncrement, minimumBid, reserveMet } from "./auction";

export type BidRejectionCode =
  | "not_found"
  | "auction_ended"
  | "below_minimum"
  | "not_an_increment"
  | "no_buy_now"
  | "outbid_race";

export type PlaceBidResult =
  | {
      ok: true;
      amount: number;
      bidCount: number;
      reserveMet: boolean;
      sold: boolean;
    }
  | { ok: false; code: BidRejectionCode; message: string; minimumBid?: number };

type PlaceBidInput = {
  vehicleId: string;
  amount: number;
  bidderId: string;
  alias: string;
  kind?: "bid" | "buy_now";
};

export async function placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
  const kind = input.kind ?? "bid";

  try {
    return await prisma.$transaction(async (tx) => {
      // Prisma has no first-class row-lock API, so this drops to raw SQL. The
      // rows come back with snake_case-free column names because the schema
      // uses Prisma's default mapping (column name === field name).
      const locked = await tx.$queryRaw<
        {
          id: string;
          startingBid: number;
          currentBid: number | null;
          reservePrice: number | null;
          buyNowPrice: number | null;
          auctionStart: Date;
          auctionEnd: Date;
          soldAt: Date | null;
        }[]
      >`
        SELECT id, "startingBid", "currentBid", "reservePrice", "buyNowPrice",
               "auctionStart", "auctionEnd", "soldAt"
        FROM "Vehicle"
        WHERE id = ${input.vehicleId}
        FOR UPDATE
      `;

      const vehicle = locked[0];
      if (!vehicle) {
        return { ok: false as const, code: "not_found" as const, message: "Vehicle not found." };
      }

      if (auctionState(vehicle) === "ended") {
        return {
          ok: false as const,
          code: "auction_ended" as const,
          message: "This lot has closed. No further bids can be placed.",
        };
      }

      if (kind === "buy_now") {
        if (vehicle.buyNowPrice === null) {
          return {
            ok: false as const,
            code: "no_buy_now" as const,
            message: "This lot does not have a Buy Now price.",
          };
        }
        if (vehicle.currentBid !== null && vehicle.currentBid >= vehicle.buyNowPrice) {
          return {
            ok: false as const,
            code: "below_minimum" as const,
            message: "Bidding has already passed the Buy Now price.",
          };
        }
      } else {
        const minimum = minimumBid(vehicle);

        if (input.amount < minimum) {
          return {
            ok: false as const,
            code: "below_minimum" as const,
            message: `Bid must be at least ${minimum}.`,
            minimumBid: minimum,
          };
        }

        // Above the minimum, bids still have to land on an increment boundary
        // so the ladder stays legible instead of filling with odd amounts.
        // Valid amounts are exactly: minimum + k * increment, for k >= 0.
        const increment = bidIncrement(vehicle.currentBid ?? vehicle.startingBid);
        if ((input.amount - minimum) % increment !== 0) {
          return {
            ok: false as const,
            code: "not_an_increment" as const,
            message: `Bids must be in increments of ${increment}.`,
            minimumBid: minimum,
          };
        }
      }

      const amount = kind === "buy_now" ? vehicle.buyNowPrice! : input.amount;

      await tx.bid.create({
        data: {
          vehicleId: vehicle.id,
          amount,
          bidderId: input.bidderId,
          alias: input.alias,
          kind,
        },
      });

      const updated = await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          currentBid: amount,
          bidCount: { increment: 1 },
          // Buy Now closes the lot immediately.
          ...(kind === "buy_now" ? { soldAt: new Date(), soldPrice: amount } : {}),
        },
        select: { bidCount: true, reservePrice: true, currentBid: true, soldAt: true },
      });

      return {
        ok: true as const,
        amount,
        bidCount: updated.bidCount,
        reserveMet: reserveMet(updated),
        sold: updated.soldAt !== null,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        code: "outbid_race",
        message: "Someone just bid that exact amount. Refresh and try again.",
      };
    }
    throw error;
  }
}
