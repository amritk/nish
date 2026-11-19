// `std/text`'s `formatI64` and `formatU64` held to the template hole they
// stand in for: every power of ten and its neighbours on both sides, both
// ends of `i64` and the top of `u64`, then two hundred thousand xorshift
// values and their shifts, each compared with `` `${x}` ``, which calls the
// runtime's C formatter natively. It is not run under the Node prelude,
// which leaves `i64` and `u64` out (`docs/RUN_UNDER_NODE.md`).
import { Suite } from "../../../std/testing.ts";
import { formatI64, formatU64 } from "../../../std/text.ts";

/** The largest `i64`, computed: its literal is above 2^53. */
const largestI64 = (): i64 => (toI64(1) << toI64(62)) - toI64(1) + (toI64(1) << toI64(62));

/** Whether `formatI64(x)` is the template hole's string for `x`. */
const agreesI64 = (x: i64): boolean => formatI64(x) === `${x}`;

/** Whether `formatU64(x)` is the template hole's string for `x`. */
const agreesU64 = (x: u64): boolean => formatU64(x) === `${x}`;

export const main = (): i32 => {
  const t = new Suite("format-int");
  const max = largestI64();
  const min = toI64(0) - max - toI64(1);

  t.eqStr("formatI64: zero", formatI64(toI64(0)), "0");
  t.eqStr("formatI64: one digit", formatI64(toI64(7)), "7");
  t.eqStr("formatI64: a negative one-digit", formatI64(toI64(-7)), "-7");
  t.eqStr("formatI64: two digits", formatI64(toI64(42)), "42");
  t.eqStr("formatI64: a negative two-digit", formatI64(toI64(-42)), "-42");
  t.eqStr("formatI64: five digits, one past a group", formatI64(toI64(10000)), "10000");
  t.eqStr("formatI64: an i32 through toI64", formatI64(toI64(toI32(-2147483647) - 1)), "-2147483648");
  t.eqStr("formatI64: the largest i64", formatI64(max), "9223372036854775807");
  t.eqStr("formatI64: the smallest i64, whose magnitude no i64 holds", formatI64(min), "-9223372036854775808");
  t.eqStr("formatU64: zero", formatU64(toU64(0)), "0");
  t.eqStr("formatU64: the largest u64, twenty digits", formatU64(toU64(0) - toU64(1)), "18446744073709551615");
  t.eqStr("formatU64: a u32 through toU64", formatU64(toU64(toU32(0) - toU32(1))), "4294967295");

  // Every digit count, at both edges and on both sides of zero.
  let tens: i32 = 0;
  let power: i64 = toI64(1);
  for (let d: i32 = 0; d < 19; d++) {
    const edges: boolean =
      agreesI64(power) &&
      agreesI64(power - toI64(1)) &&
      agreesI64(power + toI64(1)) &&
      agreesI64(toI64(0) - power) &&
      agreesI64(toI64(1) - power) &&
      agreesI64(toI64(-1) - power) &&
      agreesU64(toU64(power)) &&
      agreesU64(toU64(power) - toU64(1)) &&
      agreesU64(toU64(power) * toU64(10));
    if (edges) {
      tens += 1;
    }
    if (d < 18) {
      power = power * toI64(10);
    }
  }
  t.eqI32("formatI64 and formatU64: every power of ten and its neighbours match the template hole", tens, 19);

  let s: i64 = toI64(0x2545f491) * toI64(0x4f6cdd1d) + toI64(1);
  let mismatches: i32 = 0;
  for (let i: i32 = 0; i < 200000; i++) {
    s = s ^ (s << toI64(13));
    s = s ^ (s >>> toI64(7));
    s = s ^ (s << toI64(17));
    const shifted: i64 = s >> toI64(i % 64);
    if (!agreesI64(s) || !agreesI64(shifted) || !agreesU64(toU64(s))) {
      mismatches += 1;
    }
  }
  t.eqI32("formatI64 and formatU64: two hundred thousand xorshift values match the template hole", mismatches, 0);
  return t.done();
};
