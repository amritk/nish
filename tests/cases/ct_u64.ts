// WP34 N6: ctSelect and ctEq over u64 at the edges of the word. u64 is a BigInt
// under Node, where this source cannot run unrewritten, so the check
// `ct_prelude` in tests/run.js computes the same table with runtime/nish.mjs
// from BigInts and compares it with this case's .out, line for line.
const ones = (): u64 => toU64(0) - toU64(1);
const top = (): u64 => toU64(1) << toU64(63);

export const main = (): number => {
  const values: u64[] = [toU64(0), toU64(1), top(), ones(), top() - toU64(1)];
  for (const a of values) {
    for (const b of values) {
      console.log(`${a} ${b}: ${ctEq(a, b)} ${ctSelect(ones(), a, b)} ${ctSelect(0, a, b)} ${ctSelect(ctEq(a, b), a, 7)}`);
    }
  }
  console.log(ctSelect(top() - toU64(1), ones(), 0));
  console.log(ctEq(0, ones() - ones()));
  return 0;
};
