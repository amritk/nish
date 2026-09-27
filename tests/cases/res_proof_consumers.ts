// #234 and #235, what still compiles: a proof reaches only a proof consumer,
// so a value that flows on is tested again where it lands, and a narrowing
// ended by an assignment in an `&&` chain comes back with a test after it.
// The `reject_*_keeps_proof` and `reject_*_narrowing_assigned_in_chain`
// cases are the refused twins.
class Cell {
  v: i32 = 1;
}

const parse = (n: i32): Result<i32, i32> => (n > 0 ? Err(n) : Ok(-n));

const g = (b: boolean): boolean => b;

export const main = (): i32 => {
  const r = parse(-2);
  const q = parse(3);
  let total: i32 = 0;
  if (r.ok) {
    const z = total === 0 ? r : q;
    if (z.ok) {
      total = total + z.value;
    }
    const arr = [r, q];
    for (const each of arr) {
      if (each.isErr()) {
        total = total + each.error;
      }
    }
  }
  let s = parse(4);
  if (s.isErr() && g((s = parse(-5)).ok) && s.isOk()) {
    total = total + s.value;
  }
  let p: Cell | null = new Cell();
  if (p !== null && g((p = new Cell()) !== null) && p !== null) {
    total = total + p.v;
  }
  console.log(`${total}`);
  return 0;
};
