// The copies in tests/cases/ct_asm_p256 on known answers. That fixture holds
// the constant-time cores of `nish/crypto/p256` to the assembly check, and is
// a copy of the module's functions because the check reads one module at a
// time; this is what keeps a copy honest. Each answer was computed from the
// definition with Python's integers — a Montgomery product is
// `a * b * 2^-256` mod p (or n) — not from either copy, and
// `tests/link/crypto_p256` holds the module itself to RFC 6979 and Wycheproof.
import { Suite } from "nish/testing";
import {
  p256FiatCmovznzU32,
  p256FiatMul,
  p256FiatScalarMul,
  p256FiatSquare,
  p256TableMove,
} from "../../cases/ct_asm_p256";
import { fromHex, toHex } from "../crypto_p256/hex";

/** Eight little-endian limbs of a 64-digit big-endian hex number. */
const limbs = (text: string): u32[] => {
  const bytes: u8[] = fromHex(text);
  const out: u32[] = new Array<u32>(8);
  if (toI32(bytes.length) !== 32) {
    return out;
  }
  for (let i: i32 = 0; i < 32; i++) {
    const limb: i32 = (31 - i) >> 2;
    if (limb >= 0 && limb < 8) {
      out[limb] = (out[limb] << 8) | toU32(bytes[i]);
    }
  }
  return out;
};

/** Eight little-endian limbs as 64 digits of big-endian hex. */
const hexOf = (a: u32[]): string => {
  const bytes: u8[] = new Array<u8>(32);
  if (toI32(a.length) !== 8) {
    return "wrong length";
  }
  for (let i: i32 = 0; i < 32; i++) {
    const limb: i32 = (31 - i) >> 2;
    if (limb >= 0 && limb < 8) {
      bytes[i] = toU8(a[limb] >> toU32(8 * ((31 - i) & 3)));
    }
  }
  return toHex(bytes);
};

const A: string = "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb";
const B: string = "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d";
const P_MINUS_1: string = "ffffffff00000001000000000000000000000000fffffffffffffffffffffffe";
const P_MINUS_1_SQUARED: string = "fffffffe00000003fffffffd0000000200000001fffffffe0000000300000000";
// R mod p, R = 2^256: one in the field's Montgomery domain.
const MONT_ONE: string = "00000000fffffffeffffffffffffffffffffffff000000000000000000000001";
const ZERO: string = "0000000000000000000000000000000000000000000000000000000000000000";
const SA: string = "4cf6829aa93728e8f3c97df913fb1bfa95fe5810e2933a05943f8312a98d9cf2";
const SB: string = "b831b33e0c05b45e15bbdd9b3bfa43825fee0aa0b6e5a54e31e2bd8b073b76b7";
const N_MINUS_1: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550";

/** `p256FiatMul(a, b)` as hex. */
const mul = (a: string, b: string): string => {
  const out: u32[] = new Array<u32>(8);
  p256FiatMul(out, limbs(a), limbs(b));
  return hexOf(out);
};

/** `p256FiatSquare(a)` as hex. */
const square = (a: string): string => {
  const out: u32[] = new Array<u32>(8);
  p256FiatSquare(out, limbs(a));
  return hexOf(out);
};

/** `p256FiatScalarMul(a, b)` as hex. */
const scalarMul = (a: string, b: string): string => {
  const out: u32[] = new Array<u32>(8);
  p256FiatScalarMul(out, limbs(a), limbs(b));
  return hexOf(out);
};

export const main = (): i32 => {
  const t = new Suite("p256 ct_asm copies");

  t.eqStr("p256FiatMul: a b / R mod p", mul(A, B), "f7b77f634d49e7b16931916fe806ae02c4dc1b3efbc56b5da7aeefc0c3f6f39e");
  t.eqStr("p256FiatMul: (p - 1)^2 / R mod p", mul(P_MINUS_1, P_MINUS_1), P_MINUS_1_SQUARED);
  t.eqStr("p256FiatMul: one times a is a", mul(MONT_ONE, A), A);
  t.eqStr("p256FiatMul: zero times a is zero", mul(ZERO, A), ZERO);
  // The output may be an input, as the module's point formulas rely on.
  const inPlace: u32[] = limbs(A);
  p256FiatMul(inPlace, inPlace, limbs(B));
  t.eqStr("p256FiatMul: out may be arg1", hexOf(inPlace), mul(A, B));

  t.eqStr("p256FiatSquare: a^2 / R mod p", square(A), "33a5f07927935fea028224afa6d52c6009966566f231cc001f60a3910a739a85");
  t.eqStr("p256FiatSquare: (p - 1)^2 / R mod p", square(P_MINUS_1), P_MINUS_1_SQUARED);
  t.eqStr("p256FiatSquare is p256FiatMul of a by itself", square(B), mul(B, B));

  t.eqStr("p256FiatScalarMul: a b / R mod n", scalarMul(SA, SB), "398644212c9efd1fda959b7a3c3ccdc275942d68c27a8c80b6b19bfc9937d033");
  t.eqStr(
    "p256FiatScalarMul: (n - 1)^2 / R mod n",
    scalarMul(N_MINUS_1, N_MINUS_1),
    "60d066334905c1e907f8b6041e607725badef3e243566fafce1bc8f79c197c79"
  );

  t.eqI32("p256FiatCmovznzU32: 0 keeps arg2", toI32(p256FiatCmovznzU32(0, 7, 9)), 7);
  t.eqI32("p256FiatCmovznzU32: 1 takes arg3", toI32(p256FiatCmovznzU32(1, 7, 9)), 9);
  t.eqI32("p256FiatCmovznzU32: any non-zero takes arg3", toI32(p256FiatCmovznzU32(0x80000000, 7, 9)), 9);

  // A three-entry table of eight limbs each, entry i holding 100 i + limb.
  const table: u32[] = new Array<u32>(24);
  for (let i: i32 = 0; i < 24; i++) {
    table[i] = toU32(100 * (i >> 3) + (i & 7));
  }
  const moved: u32[] = limbs(A);
  p256TableMove(moved, table, 8, 0);
  t.eqStr("p256TableMove: hit 0 leaves out as it was", hexOf(moved), A);
  p256TableMove(moved, table, 8, 1);
  t.eqStr("p256TableMove: hit 1 takes the entry at the offset", hexOf(moved), "0000006b0000006a000000690000006800000067000000660000006500000064");

  return t.done();
};
