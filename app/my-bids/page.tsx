import { cookies } from "next/headers";
import Link from "next/link";
import { BIDDER_COOKIE } from "@/lib/session";
import { getBidderLots, type ClientVehicle } from "@/lib/vehicles";
import { VehicleCard } from "@/components/VehicleCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "My bids — The Block" };

export default async function MyBidsPage() {
  const cookieStore = await cookies();
  const bidderId = cookieStore.get(BIDDER_COOKIE)?.value;

  const entries = bidderId ? await getBidderLots(bidderId) : [];
  if (entries.length === 0) return <Empty />;

  const leading = entries.filter((entry) => entry.myBid === entry.vehicle.currentBid);
  const outbid = entries.filter((entry) => entry.myBid !== entry.vehicle.currentBid);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">My bids</h1>
      <p className="mt-1 text-[13.5px] text-ink-muted">
        {entries.length} {entries.length === 1 ? "lot" : "lots"} · {leading.length} leading ·{" "}
        {outbid.length} outbid
      </p>

      <Group title="Leading" entries={leading} />
      <Group title="Outbid" entries={outbid} />
    </div>
  );
}

function Group({
  title,
  entries,
}: {
  title: string;
  entries: { myBid: number; vehicle: ClientVehicle }[];
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
        {title} · {entries.length}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {entries.map((entry) => (
          <VehicleCard
            key={entry.vehicle.id}
            vehicle={entry.vehicle}
            position={entry.myBid}
          />
        ))}
      </div>
    </section>
  );
}

function Empty() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-16 text-center sm:px-6">
      <h1 className="text-[20px] font-bold">No bids yet</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-ink-muted">
        Lots you bid on will collect here so you can see where you stand.
      </p>
      <Link
        href="/search"
        className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-canvas"
      >
        Browse inventory
      </Link>
    </div>
  );
}
