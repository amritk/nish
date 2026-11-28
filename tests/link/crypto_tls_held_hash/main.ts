// A hash length other than 32 or 48 makes the TLS schedule's
// `tlsDeriveSecretHeld` answer `false`, with `dst` untouched.
import { Secret, secret, wipe } from "nish:secret";
import { tlsDeriveSecretHeld } from "nish/net/tls/schedule";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(40));
  const dst: Secret<u8[]> = secret(new Array<u8>(40));
  const transcript: u8[] = new Array<u8>(40);
  console.log("deriving over a 40-byte hash");
  const ok: boolean = tlsDeriveSecretHeld(toI32(40), prk, "derived", transcript, toI32(0), dst);
  console.log(`refused: ${!ok}`);
  wipe(prk);
  wipe(dst);
  return 0;
};
