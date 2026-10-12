// `hkdfExpandLabelSha256Secret` and `hkdfExpandLabelSha384Secret`, HKDF-Expand-Label
// on a secret held as a `Secret<u8[]>`: RFC 9001 A.1's Initial secrets, keys,
// IVs and header-protection keys, each derived from a `Secret` and handed on as
// one, and the SHA-384 vectors `tests/link/crypto_hkdf_expand_label` checks
// against OpenSSL and Python. Each answer is compared with the expected bytes
// inside `exposeWith`, and with what the plain `hkdfExpandLabelSha256` (or
// `384`) answers for the same input, and every `Secret` is wiped.
import { Suite } from "nish/testing";
import { Secret, exposeWith, secret, wipe } from "nish:secret";
import { timingSafeEqual } from "nish/crypto/ct";
import {
  hkdfExpandLabelSha256,
  hkdfExpandLabelSha256Secret,
  hkdfExpandLabelSha384,
  hkdfExpandLabelSha384Secret,
  hkdfExtractSha256Secret,
  hkdfExtractSha384,
} from "nish/crypto/hkdf";
import { fromHex } from "../crypto_aes/hex";
import { copyOf } from "../crypto_x25519/plain";

/** Whether the bytes a `Secret` holds are `want`, for `exposeWith` to run. */
const holds = (value: u8[], want: u8[]): boolean => timingSafeEqual(value, want);

/** Whether `s` holds the bytes `hex` spells. */
const holdsHex = (s: Secret<u8[]>, hex: string): boolean => exposeWith(s, fromHex(hex), holds);

/**
 * Whether the SHA-256 Secret form of HKDF-Expand-Label on `prk` gives `want`,
 * and the plain form gives the same bytes.
 */
const sha256Agrees = (prk: u8[], label: string, context: u8[], length: i32, want: string): boolean => {
  const held: Secret<u8[]> = secret(copyOf(prk));
  const okm: Secret<u8[]> = hkdfExpandLabelSha256Secret(held, label, context, length);
  wipe(held);
  const same: boolean = holdsHex(okm, want) && timingSafeEqual(hkdfExpandLabelSha256(prk, label, context, length), fromHex(want));
  wipe(okm);
  return same;
};

/** `sha256Agrees` with HMAC-SHA-384. */
const sha384Agrees = (prk: u8[], label: string, context: u8[], length: i32, want: string): boolean => {
  const held: Secret<u8[]> = secret(copyOf(prk));
  const okm: Secret<u8[]> = hkdfExpandLabelSha384Secret(held, label, context, length);
  wipe(held);
  const same: boolean = holdsHex(okm, want) && timingSafeEqual(hkdfExpandLabelSha384(prk, label, context, length), fromHex(want));
  wipe(okm);
  return same;
};

/** Runs every check and answers the exit code; `crypto_hkdf_expand_label_secret_f64` runs them under `--number-mode f64`. */
export const expandLabelSecretChecks = (): i32 => {
  const t = new Suite("hkdf expand label secret");
  // Typed locals rather than bare literals: a literal can be an `f64` under
  // `--number-mode f64`.
  const l12: i32 = 12;
  const l16: i32 = 16;
  const l32: i32 = 32;
  const l48: i32 = 48;
  const none: u8[] = [];

  // --- RFC 9001 A.1, the whole chain held as `Secret`s -----------------------
  const dcid: Secret<u8[]> = secret(fromHex("8394c8f03e515708"));
  const initial: Secret<u8[]> = hkdfExtractSha256Secret(fromHex("38762cf7f55934b34d179ae6a4c80cadccbb7f0a"), dcid);
  wipe(dcid);
  t.ok("RFC 9001 A.1 initial_secret", holdsHex(initial, "7db5df06e7a69e432496adedb00851923595221596ae2ae9fb8115c1e9ed0a44"));
  const client: Secret<u8[]> = hkdfExpandLabelSha256Secret(initial, "client in", none, l32);
  const server: Secret<u8[]> = hkdfExpandLabelSha256Secret(initial, "server in", none, l32);
  wipe(initial);
  t.ok("RFC 9001 A.1 client_initial_secret", holdsHex(client, "c00cf151ca5be075ed0ebfb5c80323c42d6b7db67881289af4008f1f6c357aea"));
  t.ok("RFC 9001 A.1 server_initial_secret", holdsHex(server, "3c199828fd139efd216c155ad844cc81fb82fa8d7446fa7d78be803acdda951b"));
  const clientKey: Secret<u8[]> = hkdfExpandLabelSha256Secret(client, "quic key", none, l16);
  const clientIv: Secret<u8[]> = hkdfExpandLabelSha256Secret(client, "quic iv", none, l12);
  const clientHp: Secret<u8[]> = hkdfExpandLabelSha256Secret(client, "quic hp", none, l16);
  wipe(client);
  t.ok("RFC 9001 A.1 client key", holdsHex(clientKey, "1f369613dd76d5467730efcbe3b1a22d"));
  t.ok("RFC 9001 A.1 client iv", holdsHex(clientIv, "fa044b2f42a3fd3b46fb255c"));
  t.ok("RFC 9001 A.1 client hp", holdsHex(clientHp, "9f50449e04a0e810283a1e9933adedd2"));
  wipe(clientKey);
  wipe(clientIv);
  wipe(clientHp);
  const serverPrk: u8[] = fromHex("3c199828fd139efd216c155ad844cc81fb82fa8d7446fa7d78be803acdda951b");
  t.ok(
    "RFC 9001 A.1 server key, the Secret form and the plain one alike",
    sha256Agrees(serverPrk, "quic key", none, l16, "cf3a5331653c364c88f0f379b6067e37")
  );
  t.ok(
    "RFC 9001 A.1 server iv, the Secret form and the plain one alike",
    sha256Agrees(serverPrk, "quic iv", none, l12, "0ac1493ca1905853b0bba03e")
  );
  t.ok(
    "RFC 9001 A.1 server hp, the Secret form and the plain one alike",
    sha256Agrees(serverPrk, "quic hp", none, l16, "c206b8d9b9f0f37644430b490eeaa314")
  );
  wipe(server);

  // --- SHA-384 ----------------------------------------------------------------
  const early384: u8[] = hkdfExtractSha384(none, new Array<u8>(48));
  t.ok(
    'SHA-384 "tls13 derived" over the empty transcript hash',
    sha384Agrees(
      early384,
      "derived",
      fromHex("38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b"),
      l48,
      "1591dac5cbbf0330a4a84de9c753330e92d01f0a88214b4464972fd668049e93e52f2b16fad922fdc0584478428f282b"
    )
  );
  t.ok("SHA-384 key (32 bytes)", sha384Agrees(early384, "key", none, l32, "ebcdc973d6a2f2183366ca8b2fd863591bf528b2524b5cd7c66cf7a70467b6cf"));
  t.ok("SHA-384 iv", sha384Agrees(early384, "iv", none, l12, "22ac56124d171e635cebe14e"));
  t.ok(
    "SHA-384 finished (48 bytes)",
    sha384Agrees(
      early384,
      "finished",
      none,
      l48,
      "67821fe38fe191a64add771cd551ebe7ca5d291ff5bdaca60c86428d6f7338948611d7b79a4e4cd7999abdf215b02a66"
    )
  );
  return t.done();
};
