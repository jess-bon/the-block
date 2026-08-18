import { NextResponse, type NextRequest } from "next/server";
import { placeBid } from "@/lib/bidding";
import { aliasFor, BIDDER_COOKIE } from "@/lib/session";

const REJECTION_STATUS: Record<string, number> = {
  not_found: 404,
  auction_ended: 409,
  outbid_race: 409,
  below_minimum: 422,
  not_an_increment: 422,
  no_buy_now: 422,
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const bidderId = request.cookies.get(BIDDER_COOKIE)?.value;
  if (!bidderId) {
    return NextResponse.json(
      { error: "No bidder session. Reload the page and try again." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { amount, kind } = (body ?? {}) as { amount?: unknown; kind?: unknown };

  if (kind !== undefined && kind !== "bid" && kind !== "buy_now") {
    return NextResponse.json({ error: "Unknown bid kind." }, { status: 400 });
  }

  // Buy Now takes its amount from the vehicle row inside the transaction, so it
  // is the one case where the client does not supply one.
  if (kind !== "buy_now") {
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Bid amount must be a positive whole number." },
        { status: 400 },
      );
    }
  }

  const result = await placeBid({
    vehicleId: id,
    amount: typeof amount === "number" ? amount : 0,
    bidderId,
    alias: aliasFor(bidderId),
    kind: kind === "buy_now" ? "buy_now" : "bid",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code, minimumBid: result.minimumBid },
      { status: REJECTION_STATUS[result.code] ?? 400 },
    );
  }

  return NextResponse.json(result, { status: 201 });
}
