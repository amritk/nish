// `crypto_hkdf_expand_label_secret_short` with HMAC-SHA-384: a secret shorter
// than its 48-byte HashLen panics in the `Secret` form of HKDF-Expand-Label, as
// in the plain one (`crypto_hkdf_expand_label_short_secret_sha384`).
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha384Secret: a secret shorter than 48 bytes
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelSha384Secret } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const len: i32 = 16;
  const full: Secret<u8[]> = secret(new Array<u8>(48));
  const okm: Secret<u8[]> = hkdfExpandLabelSha384Secret(full, "key", [], len);
  wipe(full);
  wipe(okm);
  console.log("48-byte secret: accepted");
  const short: Secret<u8[]> = secret(new Array<u8>(47));
  const refused: Secret<u8[]> = hkdfExpandLabelSha384Secret(short, "key", [], len);
  wipe(short);
  wipe(refused);
  console.log("unreachable: answered");
  return 0;
};
