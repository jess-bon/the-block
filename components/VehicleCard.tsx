import Link from "next/link";
import type { ClientVehicle } from "@/lib/vehicles";
import { formatKm, formatMoney, vehicleTitle } from "@/lib/auction";
import { Countdown } from "./Countdown";
import { VehiclePhoto } from "./VehiclePhoto";
import { GradeBadge, ReserveBadge, StateBadge, TitleBadge } from "./Badges";

export function VehicleCard({
  vehicle,
  position,
}: {
  vehicle: ClientVehicle;
  /** This browser's highest bid on the lot, if any. */
  position?: number;
}) {
  const hasBid = vehicle.currentBid !== null;
  const price = vehicle.currentBid ?? vehicle.startingBid;
  const isHighBidder = position !== undefined && position === vehicle.currentBid;
  const isOutbid = position !== undefined && !isHighBidder;

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface transition-colors hover:border-hairline-strong focus-visible:border-accent"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-raised">
        <VehiclePhoto
          src={vehicle.images[0]}
          alt={vehicleTitle(vehicle)}
          label={vehicleTitle(vehicle)}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <StateBadge state={vehicle.state} />
          <TitleBadge status={vehicle.titleStatus} />
        </div>
        <div className="absolute right-2 top-2">
          <GradeBadge grade={vehicle.conditionGrade} />
        </div>
        {vehicle.images.length > 1 && (
          <span className="tnum absolute bottom-2 right-2 rounded bg-canvas/75 px-1.5 py-0.5 text-[11px] text-ink-muted">
            {vehicle.images.length} photos
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div>
          <h3 className="truncate text-[14px] font-semibold leading-snug">
            {vehicleTitle(vehicle)}
          </h3>
          <p className="tnum mt-0.5 truncate text-[12px] text-ink-faint">
            Lot {vehicle.lot} · {formatKm(vehicle.odometerKm)} · {vehicle.city}, {vehicle.province}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">
              {hasBid ? `Current bid · ${vehicle.bidCount}` : "Starting bid"}
            </p>
            <p className="tnum text-[19px] font-bold leading-tight">{formatMoney(price)}</p>
            <ReserveBadge
              hasReserve={vehicle.hasReserve}
              met={vehicle.reserveMet}
              hasBid={hasBid}
            />
          </div>
          <div className="text-right">
            <Countdown
              endsAt={vehicle.auctionEnd.toISOString()}
              startsAt={vehicle.auctionStart.toISOString()}
              state={vehicle.state}
              className="block text-[12px] font-medium text-ink-muted"
            />
            {isHighBidder && (
              <span className="mt-1 inline-block rounded bg-good-soft px-1.5 py-0.5 text-[11px] font-semibold text-good">
                High bid
              </span>
            )}
            {isOutbid && (
              <span className="mt-1 inline-block rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn">
                Outbid
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
