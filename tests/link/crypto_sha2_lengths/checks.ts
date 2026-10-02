// The SHA-2 length counters at the boundaries where a narrower counter would
// break. §5.1.1 and §5.1.2 of FIPS 180-4 end every message with its length in
// bits, and that field is where a hash that is right on every short vector goes
// wrong on a long message: at 2^29 bytes the bit count passes 2^32 (a `u32` of
// bits wraps), at 2^31 the byte count passes an `i32`, at 2^32 a `u32` of
// bytes wraps, and at 2^61 SHA-512's bit count needs its high word.
//
// Nobody can hash 2^61 real bytes in a test, so each check sets the counter
// directly (`Sha256.total`, `Sha512Engine.count`) to a length already
// absorbed, with the hash value still H(0), and then feeds a short tail through
// `update` so the counter crosses the boundary inside the call. The expected
// digests are the same computation — H(0), the tail, and padding carrying the
// injected length — done by a BigInt reference that was checked against
// `node:crypto` on every message of 0 to 299 bytes (docs/security/crypto-k1.md
// says how). A tail of 60 bytes for SHA-256 and 120 for SHA-512 leaves no room
// for the length in its block, so those checks put it in a second block.
//
// `main.ts` runs this under `--number-mode i32` and `../crypto_sha2_lengths_f64`
// under `f64`: the counters are `i64` and `u64` whatever `number` is, and this
// is what holds them to it.
import { Sha256 } from "nish/crypto/sha256";
import { Sha384, Sha512 } from "nish/crypto/sha512";
import { Suite } from "nish/testing";

const LENGTH_HEX: string = "0123456789abcdef";

/** `bytes` as lowercase hex. */
const lengthsHex = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(LENGTH_HEX.substring(v >> 4, (v >> 4) + 1));
    parts.push(LENGTH_HEX.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The tail every check feeds after the injected length: byte `i` is `7i + 1`. */
const lengthsTail = (n: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8((i * 7 + 1) & 255));
  }
  return out;
};

/** 2^k minus `less`, as an `i64`; a literal past 2^53 cannot be written exactly. */
const pow2Less = (k: i64, less: i64): i64 => (toI64(1) << k) - less;

/** SHA-256 of `tail` after a counter set to `absorbed` bytes. */
const sha256After = (absorbed: i64, tailLength: i32): string => {
  const h = new Sha256();
  h.total = absorbed;
  const tail: u8[] = lengthsTail(tailLength);
  h.update(tail, toI32(0), toI32(tail.length));
  return lengthsHex(h.digest());
};

/** SHA-512 (or SHA-384, when `short`) of `tail` after a counter set to `absorbed` bytes. */
const sha512After = (absorbed: u64, tailLength: i32, short: boolean): string => {
  const tail: u8[] = lengthsTail(tailLength);
  if (short) {
    const h = new Sha384();
    h.engine.count = absorbed;
    h.update(tail, toI32(0), toI32(tail.length));
    return lengthsHex(h.digest());
  }
  const h = new Sha512();
  h.engine.count = absorbed;
  h.update(tail, toI32(0), toI32(tail.length));
  return lengthsHex(h.digest());
};

/** The checks, in a function `main.ts` and the f64 twin both call. */
export const lengthChecks = (): i32 => {
  const t = new Suite("sha2 lengths");
  const one: i64 = 1;
  const three: i64 = 3;
  const four: i64 = 4;
  const sixty: i64 = 60;
  const b29: i64 = 29;
  const b31: i64 = 31;
  const b32: i64 = 32;
  const b61: i64 = 61;

  // --- SHA-256: a 64-bit bit count, from an `i64` byte count (§5.1.1) --------
  t.eqStr(
    "sha256: 2^29 + 2 bytes, the bit count past 2^32",
    sha256After(pow2Less(b29, one), 3),
    "9efc907d32890078a4c9010a51ea3ffde5707614bc9716bb61e02c30426080ab"
  );
  t.eqStr(
    "sha256: exactly 2^29 bytes, the length in the second block",
    sha256After(pow2Less(b29, sixty), 60),
    "b23b663b1023a7b34cdfffd72db6e522fe70df2c00dc95f2d7d2a7ecefbb9747"
  );
  t.eqStr(
    "sha256: 2^31 + 1 bytes, the byte count past an i32",
    sha256After(pow2Less(b31, toI64(2)), 3),
    "4fe310db2c47ed6afeb625868d6c0762736cd8e45c6941834ac2d32ee2011b88"
  );
  t.eqStr(
    "sha256: 2^32 + 2 bytes, the byte count past a u32",
    sha256After(pow2Less(b32, one), 3),
    "e0b73a8186ee02f576b7b017da7c8c6e590eb2fd537d33eded3ca88174d48195"
  );
  t.eqStr(
    "sha256: 2^32 + 59 bytes, the length in the second block",
    sha256After(pow2Less(b32, one), 60),
    "77eea53a7a7327a2264aac55cfd190dab20bc6446cd394ce2231e48be0444833"
  );
  t.eqStr(
    "sha256: 2^61 - 1 bytes, the longest message whose bit count fits 64 bits",
    sha256After(pow2Less(b61, four), 3),
    "3e79a0a7bbfeda3d8e659af6640a3972c8161f15bf6dd1e396d062c859506f09"
  );

  // --- SHA-512 and SHA-384: a 128-bit bit count, from a `u64` byte count (§5.1.2)
  const all: u64 = ~toU64(0);
  t.eqStr(
    "sha512: 2^29 + 2 bytes, the bit count past 2^32",
    sha512After(toU64(pow2Less(b29, one)), 3, false),
    "8a2a9066c296b753327a806e19f95acb22c92444ff0f24e1749618695581fe7785180a0b383f133cd13f6c4793310ddfcda3b9f22a96aefe31a175a5c1062f01"
  );
  t.eqStr(
    "sha512: 2^32 + 2 bytes, the byte count past a u32",
    sha512After(toU64(pow2Less(b32, one)), 3, false),
    "ca32450f5482b3d513748e21e04aa9343ab8fe909ceb4ac0f2f985a883be89db5db4aa1847a4902691a328c3b2ccc8974560d1dfa137b4b5e61902c1659bc492"
  );
  t.eqStr(
    "sha512: 2^32 + 119 bytes, the length in the second block",
    sha512After(toU64(pow2Less(b32, one)), 120, false),
    "d11dc7c33498b5775679efc1da01669c7454cf415a0c4ad0b8a72a9ba92bdc2897e9dc5bb0ce13484224cb42493a3d2f77cf4f212c84ee63b02fe2581bbe0b6b"
  );
  t.eqStr(
    "sha512: 2^61 + 1 bytes, the first length with a high word of bits",
    sha512After(toU64(pow2Less(b61, toI64(2))), 3, false),
    "96e199584b57b2a755d2e3b8abe6209b44304f935574f5846ab67df141fc641cf3b437fbc115f27e2993541734661f556246ddcfb4b9365c67b7b93cfeca36d1"
  );
  t.eqStr(
    "sha512: 2^64 - 1 bytes, the longest a u64 counts",
    sha512After(all - toU64(three), 3, false),
    "29f69b5c5c8b0e077a4ce06778b6af28d0f1e5d167668e0ebcffea67e4f94c310c334da91a2af5fd25edbdef22030ba15986b9608264d8501a679be5f3e17c4b"
  );
  t.eqStr(
    "sha512: 2^64 - 1 bytes, the length in the second block",
    sha512After(all - toU64(120), 120, false),
    "f8645fde1a6b388627fca91bad633b073f79dfaf014c57b104f83a4e9b1089c70a65ec8045bbd7862a04fe16febd6b41d2646b98e76692ec9f94ff5d2ee466fa"
  );
  t.eqStr(
    "sha384: 2^29 + 2 bytes, the bit count past 2^32",
    sha512After(toU64(pow2Less(b29, one)), 3, true),
    "32fb61d60cd89bf731e906716c9d70f1061380ccd954daeb7fa6b3176ef7163fd882216e16ac4354838b74409cc1c0c0"
  );
  t.eqStr(
    "sha384: 2^32 + 2 bytes, the byte count past a u32",
    sha512After(toU64(pow2Less(b32, one)), 3, true),
    "342f294bfd858eb7ead509714322c57a1849d75ffb25d9c9f707135b3aef2c3991b0759997e6e62556af4caeea760034"
  );
  t.eqStr(
    "sha384: 2^32 + 119 bytes, the length in the second block",
    sha512After(toU64(pow2Less(b32, one)), 120, true),
    "fa7b171e12aa879ebb792926006c85600a40775700fac2d8d37be607c1fdcdc9e1436a8fa375c9afc4e5ebceff353ff2"
  );
  t.eqStr(
    "sha384: 2^61 + 1 bytes, the first length with a high word of bits",
    sha512After(toU64(pow2Less(b61, toI64(2))), 3, true),
    "f5f9e705363b4ca44292e9c53c7205c5c7ce2d12bf6c86f7b3e91c6408e55cf29c92ac1de2162450b2239276b650d2ba"
  );
  t.eqStr(
    "sha384: 2^64 - 1 bytes, the longest a u64 counts",
    sha512After(all - toU64(three), 3, true),
    "a5a0f967299f0a21e9875882ee4df44563a7bbb8e69c046a5c12758a37a210a5e3354f2dda3515f1fd15e572b36d0cb8"
  );
  t.eqStr(
    "sha384: 2^64 - 1 bytes, the length in the second block",
    sha512After(all - toU64(120), 120, true),
    "ae610f346a6d3bc4f0f226cc613e43d0590437041e8bbd7fcf9634f893e9b8952a46be6920fe26e1361b4b6b79610f4e"
  );
  return t.done();
};
