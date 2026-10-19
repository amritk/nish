// A held destination of more than 255 bytes panics in
// `hkdfExpandLabelSha256Held` ("hkdfExpandLabelSha256Held: a length of 256
// bytes, outside 0 to 255", on stderr): the HkdfLabel of RFC 8446 §7.1 has
// room for no longer output, so it is the caller's bug. Exit 1, and nothing
// on stdout after the line printed before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelSha256Held } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(32));
  const dst: Secret<u8[]> = secret(new Array<u8>(256));
  const context: u8[] = [];
  console.log("expanding into a 256-byte secret");
  hkdfExpandLabelSha256Held(dst, prk, "quic key", context);
  console.log("unreachable: a 256-byte output was accepted");
  wipe(prk);
  wipe(dst);
  return 0;
};
