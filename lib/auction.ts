/**
 * Auction domain rules.
 *
 * The dataset ships prices and timestamps but no bidding rules, so the rules
 * below are this prototype's invention. They are deliberately kept in one
 * module, free of React and Prisma imports, so the same logic runs on the
 * server (validating a bid) and in the browser (previewing the next bid).
 */

export type AuctionState = "upcoming" | "live" | "ended";

export function bidIncrement(currentPrice: number): number {
  if (currentPrice < 5_000) return 100;
  if (currentPrice < 20_000) return 250;
  if (currentPrice < 50_000) return 500;
  return 1_000;
}

export function minimumBid(vehicle: {
  startingBid: number;
  currentBid: number | null;
}): number {
  if (vehicle.currentBid === null) return vehicle.startingBid;
  return vehicle.currentBid + bidIncrement(vehicle.currentBid);
}

export function auctionState(
  vehicle: { auctionStart: Date; auctionEnd: Date; soldAt: Date | null },
  now: Date = new Date(),
): AuctionState {
  if (vehicle.soldAt) return "ended";
  if (now < vehicle.auctionStart) return "upcoming";
  if (now >= vehicle.auctionEnd) return "ended";
  return "live";
}

/**
 * Reserve is the seller's confidential floor.
 */
export function reserveMet(vehicle: {
  reservePrice: number | null;
  currentBid: number | null;
}): boolean {
  if (vehicle.reservePrice === null) return true;
  if (vehicle.currentBid === null) return false;
  return vehicle.currentBid >= vehicle.reservePrice;
}

/** Condition grades are the 1.0–5.0 scale used on wholesale inspection reports. */
export function gradeBand(grade: number): {
  label: string;
  tone: "good" | "fair" | "poor" | "severe";
} {
  if (grade >= 4.0) return { label: "Excellent", tone: "good" };
  if (grade >= 3.0) return { label: "Average", tone: "fair" };
  if (grade >= 2.0) return { label: "Rough", tone: "poor" };
  return { label: "Salvage grade", tone: "severe" };
}

/**
 * Damage notes arrive as free text with no severity field, but they are drawn
 * from a fixed vocabulary that splits cleanly into cosmetic wear versus things
 * that should stop a buyer. Flagging the structural and mechanical ones lets
 * the detail page lead with the problems instead of burying them in a list.
 */
const STRUCTURAL_PATTERNS = [
  /frame damage/i,
  /airbag deployed/i,
  /flood damage/i,
  /water damage/i,
];

const MECHANICAL_PATTERNS = [
  /transmission slips/i,
  /check engine light/i,
  /ac compressor/i,
  /brake rotors/i,
  /not roadworthy/i,
];

export type DamageSeverity = "structural" | "mechanical" | "cosmetic";

export function damageSeverity(note: string): DamageSeverity {
  if (STRUCTURAL_PATTERNS.some((pattern) => pattern.test(note))) return "structural";
  if (MECHANICAL_PATTERNS.some((pattern) => pattern.test(note))) return "mechanical";
  return "cosmetic";
}

export function titleStatusWarning(titleStatus: string): string | null {
  if (titleStatus === "salvage") {
    return "Salvage title. This vehicle was declared a total loss by an insurer and may not be roadworthy.";
  }
  if (titleStatus === "rebuilt") {
    return "Rebuilt title. Previously declared a total loss and since repaired. Resale value is typically reduced.";
  }
  return null;
}

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return CAD.format(amount);
}

export function formatKm(km: number): string {
  return `${new Intl.NumberFormat("en-CA").format(km)} km`;
}

/** Compact "2d 4h" / "3h 12m" / "48s" countdown label. */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "0m";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function vehicleTitle(vehicle: {
  year: number;
  make: string;
  model: string;
  trim: string;
}): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
}
