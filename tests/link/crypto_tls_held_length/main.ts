// A held secret that is not the hash's length makes the TLS schedule's
// `tlsDeriveSecretHeld` answer `false`, with `dst` untouched: every secret of
// the schedule is HashLen bytes.
import { Secret, secret, wipe } from "nish:secret";
import { tlsDeriveSecretHeld } from "nish/net/tls/schedule";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(32));
  const dst: Secret<u8[]> = secret(new Array<u8>(16));
  const transcript: u8[] = new Array<u8>(32);
  console.log("deriving into a 16-byte secret under SHA-256");
  const ok: boolean = tlsDeriveSecretHeld(toI32(32), prk, "derived", transcript, toI32(0), dst);
  console.log(`refused: ${!ok}`);
  wipe(prk);
  wipe(dst);
  return 0;
};
