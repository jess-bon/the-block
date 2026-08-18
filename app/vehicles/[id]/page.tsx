import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVehicle, type ClientVehicle } from "@/lib/vehicles";
import { BIDDER_COOKIE } from "@/lib/session";
import { formatKm, vehicleTitle } from "@/lib/auction";
import { Gallery } from "@/components/Gallery";
import { BidPanel } from "@/components/BidPanel";
import { BidHistory } from "@/components/BidHistory";
import { ConditionPanel } from "@/components/ConditionPanel";
import { StateBadge, TitleBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getVehicle(id);
  if (!result) return { title: "Lot not found — The Block" };
  return { title: `${vehicleTitle(result.vehicle)} — Lot ${result.vehicle.lot}` };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getVehicle(id);
  if (!result) notFound();

  const { vehicle, bids } = result;
  const cookieStore = await cookies();
  const bidderId = cookieStore.get(BIDDER_COOKIE)?.value;

  const myBids = bidderId ? bids.filter((bid) => bid.bidderId === bidderId) : [];
  const myPosition = myBids.length ? Math.max(...myBids.map((bid) => bid.amount)) : null;

  // `caps` marks the fields the dataset stores lowercase ("automatic", "suv").
  // Pre-formatted values like the odometer must not be touched, or "km"
  // renders as "Km".
  const specs: { label: string; value: string; caps?: boolean }[] = [
    { label: "Odometer", value: formatKm(vehicle.odometerKm) },
    { label: "Engine", value: vehicle.engine },
    { label: "Transmission", value: vehicle.transmission, caps: true },
    { label: "Drivetrain", value: vehicle.drivetrain },
    { label: "Fuel", value: vehicle.fuelType, caps: true },
    { label: "Body style", value: vehicle.bodyStyle, caps: true },
    { label: "Exterior", value: vehicle.exteriorColor },
    { label: "Interior", value: vehicle.interiorColor },
    { label: "Title", value: vehicle.titleStatus, caps: true },
    { label: "VIN", value: vehicle.vin },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <Link
        href="/search"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> Back to inventory
      </Link>

      {/*
        One instance of each panel, positioned by grid placement rather than
        rendered twice behind `lg:hidden`. Two mounts meant two countdown
        intervals and — worse — a duplicate id="bid-amount" in the DOM, which
        silently broke the label association for the second copy.

        Mobile order: photos, bid, condition, specs, dealer.
        Desktop: left column of detail, sticky bid rail on the right.
      */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="order-1 lg:col-start-1 lg:row-start-1 space-y-6">
          <div>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <StateBadge state={vehicle.state} />
              <TitleBadge status={vehicle.titleStatus} />
              <span className="tnum text-[12.5px] text-ink-faint">Lot {vehicle.lot}</span>
            </div>
            <h1 className="text-[24px] font-bold leading-tight tracking-tight sm:text-[30px]">
              {vehicleTitle(vehicle)}
            </h1>
            <p className="tnum mt-1 text-[13.5px] text-ink-muted">
              {formatKm(vehicle.odometerKm)} · {vehicle.city}, {vehicle.province}
            </p>
          </div>

          <Gallery images={vehicle.images} alt={vehicleTitle(vehicle)} />
        </div>

        <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="space-y-5 lg:sticky lg:top-20">
            <BidPanel vehicle={serializeForPanel(vehicle)} myPosition={myPosition} />
            <BidHistory bids={bids} bidderId={bidderId} />
          </div>
        </div>

        <div className="order-3 lg:col-start-1 lg:row-start-2 space-y-6">
          <ConditionPanel
            grade={vehicle.conditionGrade}
            report={vehicle.conditionReport}
            damageNotes={vehicle.damageNotes}
            titleStatus={vehicle.titleStatus}
          />

          <section className="rounded-xl border border-hairline bg-surface p-5">
            <h2 className="text-[15px] font-semibold">Specifications</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-faint">
                    {spec.label}
                  </dt>
                  <dd
                    className={`tnum mt-0.5 truncate text-[13.5px] ${spec.caps ? "capitalize" : ""}`}
                    title={spec.value}
                  >
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-hairline bg-surface p-5">
            <h2 className="text-[15px] font-semibold">Selling dealer</h2>
            <p className="mt-3 text-[15px] font-medium">{vehicle.sellingDealership}</p>
            <p className="mt-0.5 text-[13.5px] text-ink-muted">
              {vehicle.city}, {vehicle.province}
            </p>
            <p className="mt-3 border-t border-hairline pt-3 text-[12.5px] leading-relaxed text-ink-faint">
              Condition details are supplied by the selling dealer. Arrange an independent
              inspection before bidding on lots with structural damage.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Narrows the vehicle to exactly what the bid panel needs, with dates as ISO
 * strings. Keeping this explicit rather than spreading the whole record means
 * nothing extra leaks into the client bundle by accident.
 */
function serializeForPanel(vehicle: ClientVehicle) {
  return {
    id: vehicle.id,
    startingBid: vehicle.startingBid,
    currentBid: vehicle.currentBid,
    buyNowPrice: vehicle.buyNowPrice,
    bidCount: vehicle.bidCount,
    hasReserve: vehicle.hasReserve,
    reserveMet: vehicle.reserveMet,
    state: vehicle.state,
    auctionStart: vehicle.auctionStart.toISOString(),
    auctionEnd: vehicle.auctionEnd.toISOString(),
    soldPrice: vehicle.soldPrice,
  };
}
