import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A feed token: 32 random bytes, base64url without padding (43 characters). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isFeedToken(value: string) {
  return TOKEN.test(value);
}

/** What's stored for a token: its SHA-256, in hex. */
export function hashFeedToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** A new private feed token and the hash to store for it. The token itself is never stored. */
export function newFeedToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashFeedToken(token) };
}
