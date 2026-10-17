// A held secret that is not the hash's length panics in the TLS schedule's
// `*Held` steps ("tlsDeriveSecretHeld: a secret of 16 bytes, not 32", on
// stderr): every secret of the schedule is HashLen bytes, so a shorter `dst`
// is the caller's bug. Exit 1, and nothing on stdout after the line printed
// before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { tlsDeriveSecretHeld } from "nish/net/tls/schedule";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(32));
  const dst: Secret<u8[]> = secret(new Array<u8>(16));
  const transcript: u8[] = new Array<u8>(32);
  console.log("deriving into a 16-byte secret under SHA-256");
  tlsDeriveSecretHeld(toI32(32), prk, "derived", transcript, toI32(0), dst);
  console.log("unreachable: a 16-byte secret was accepted");
  wipe(prk);
  wipe(dst);
  return 0;
};
