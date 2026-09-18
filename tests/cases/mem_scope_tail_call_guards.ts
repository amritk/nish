// WP6 guard cases: four recursions that look like the one in
// `mem_scope_tail_call` and must keep `@nish_arena_release` *after* the call,
// with no `tail` on it. The golden is read for that order, because sinking a
// release wrongly is a use-after-free or a wrong number, and only the first of
// those would crash.
//
//   walk   takes a `string`. That argument is arena memory above the mark, so
//          a release before the call hands the callee bytes the next bump
//          reuses. This is the shape that looks most like it should qualify.
//   watch  reads the bump position. Releasing first would not corrupt
//          anything; it would make `Arena.used()` answer a smaller number, and
//          `readsArenaState` is the fact that keeps the answer the same. The
//          value is deliberately unused: what disqualifies the call is the
//          read, not what the program does with it.
//   after  adds to the call's result, so the call is not in tail position at
//          all and there is nothing to sink it past.
//   Depth  is a method, and a method's receiver is an argument that the
//          argument list does not carry: `%this` is a pointer, so neither the
//          release nor the `tail` marker may be told that everything the
//          callee holds is a scalar. Comparing the parameter count with the
//          argument count is what refuses it — a signature with one more
//          parameter than there are arguments is one whose first argument was
//          never looked at.
const walk = (n: number, text: string): number => {
  if (n === 0) return text.length;
  return walk(n - 1, text + `${n}`);
};

const watch = (n: number, acc: number): number => {
  if (n === 0) return acc;
  const label = `item ${n}`;
  const bump = Arena.used();
  return watch(n - 1, acc + label.length);
};

const after = (n: number): number => {
  if (n === 0) return 0;
  const label = `item ${n}`;
  return after(n - 1) + label.length;
};

class Depth {
  base: number;

  constructor(base: number) {
    this.base = base;
  }

  down(n: number, acc: number): number {
    if (n === 0) return acc + this.base;
    const label = `item ${n}`;
    return this.down(n - 1, acc + label.length);
  }
}

export const main = (): number => {
  console.log(`${walk(3, "")}`);
  console.log(`${watch(3, 0)}`);
  console.log(`${after(3)}`);
  const depth = new Depth(100);
  console.log(`${depth.down(3, 0)}`);
  return 0;
};
