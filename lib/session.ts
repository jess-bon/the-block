/**
 * The synthetic buyer identity. No auth in this prototype — see middleware.ts
 * for why a stable per-browser id exists at all.
 *
 * Kept in its own module so pages and route handlers can read the cookie name
 * without importing middleware.ts, which runs in Edge vs Node.
 */
export const BIDDER_COOKIE = "bidder_id";

/** Human-readable handle derived from the opaque cookie id. */
export function aliasFor(bidderId: string): string {
  let hash = 0;
  for (let index = 0; index < bidderId.length; index += 1) {
    hash = (hash * 31 + bidderId.charCodeAt(index)) | 0;
  }
  return `Bidder ${1000 + (Math.abs(hash) % 9000)}`;
}
