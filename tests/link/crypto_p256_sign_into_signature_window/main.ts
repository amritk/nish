// A signature window that runs past its array panics in `p256SignSha256Into`
// ("p256SignSha256Into: the signature window is outside its array", on stderr)
// before anything is written, rather than writing the part of `r || s` that
// fits. Exit 1, and nothing on stdout after the line printed before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { P256SignScratch, p256SignSha256Into } from "nish/crypto/p256";

export const main = (): i32 => {
  const scratch = new P256SignScratch();
  const key: Secret<u8[]> = secret(new Array<u8>(32));
  const msg: u8[] = new Array<u8>(10);
  const sig: u8[] = new Array<u8>(70);
  console.log("writing a 64-byte signature at sig[7] of 70 bytes");
  const ok: boolean = p256SignSha256Into(scratch, key, msg, toI32(0), toI32(10), sig, toI32(7));
  wipe(key);
  console.log(`unreachable: an out-of-range signature window was accepted (${ok})`);
  return 0;
};
