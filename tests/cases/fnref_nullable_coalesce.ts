// WP51 stage 2: `??` on a nullable function reference. A reference is an
// i32 tag and `null` is tag 0, so `??` tests the tag against 0: on a local,
// on what `Map.get` finds, and on a `?.` read of a nullable field.
type F = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;
const dbl = (x: i32): i32 => x * 2;

const pick = (k: i32): F | null => (k > 0 ? dbl : null);

class Holder {
  op: F | null = null;
}

const holderOf = (k: i32): Holder | null => {
  if (k === 0) {
    return null;
  }
  const h = new Holder();
  if (k > 1) {
    h.op = dbl;
  }
  return h;
};

export const main = (): void => {
  const none = pick(0);
  const some = pick(1);
  const a: F = none ?? inc;
  const b: F = some ?? inc;
  const m = new Map<i32, F>();
  m.set(1, dbl);
  const c = m.get(2) ?? inc;
  const d = m.get(1) ?? inc;
  const e = holderOf(0)?.op ?? inc;
  const f = holderOf(1)?.op ?? inc;
  const g = holderOf(2)?.op ?? inc;
  console.log(`${a(5)} ${b(5)} ${c(5)} ${d(5)} ${e(5)} ${f(5)} ${g(5)}`);
};
