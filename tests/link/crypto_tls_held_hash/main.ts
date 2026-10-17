// A hash length other than 32 or 48 panics in the TLS schedule's `*Held`
// steps ("tlsDeriveSecretHeld: a hash length of 40, not 32 or 48", on
// stderr), even when both secrets hold that many bytes: it names no hash the
// schedule runs over, and is the caller's bug. Exit 1, and nothing on stdout
// after the line printed before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { tlsDeriveSecretHeld } from "nish/net/tls/schedule";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(40));
  const dst: Secret<u8[]> = secret(new Array<u8>(40));
  const transcript: u8[] = new Array<u8>(40);
  console.log("deriving over a 40-byte hash");
  tlsDeriveSecretHeld(toI32(40), prk, "derived", transcript, toI32(0), dst);
  console.log("unreachable: a 40-byte hash was accepted");
  wipe(prk);
  wipe(dst);
  return 0;
};
