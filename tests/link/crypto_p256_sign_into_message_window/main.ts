// A message window that runs past its array panics in `p256SignSha256Into`
// ("p256SignSha256Into: the message window is outside its array", on stderr)
// before the key or the message is read, rather than signing the part that
// fits. Exit 1, and nothing on stdout after the line printed before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { P256SignScratch, p256SignSha256Into } from "nish/crypto/p256";

export const main = (): i32 => {
  const scratch = new P256SignScratch();
  const key: Secret<u8[]> = secret(new Array<u8>(32));
  const msg: u8[] = new Array<u8>(10);
  const sig: u8[] = new Array<u8>(64);
  console.log("signing 8 bytes at msg[4] of 10 bytes");
  const ok: boolean = p256SignSha256Into(scratch, key, msg, toI32(4), toI32(8), sig, toI32(0));
  wipe(key);
  console.log(`unreachable: an out-of-range message window was accepted (${ok})`);
  return 0;
};
