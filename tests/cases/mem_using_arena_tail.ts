// A `return g(n)` inside a `using a = arena()` block whose arguments are all
// numbers is a tail call, and the block's release moves ahead of it as a
// function scope's does — unless `g` reads the arena, which would then see the
// block already gone. `run` gets no automatic scope (it stores a fresh string
// into `t` before the block), so the release on those edges is the block's:
// `report` runs before it and sees the block's memory, `quiet` is `tail` and
// runs after it.
class Tally {
  label: string = "";
}

const fill = (k: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < k; i++) {
    xs.push(i);
  }
  return xs;
};

const report = (base: i64): void => {
  console.log(Arena.used() > base ? "inside" : "released");
};

const quiet = (n: i32): void => {
  console.log(`${n}`);
};

const run = (t: Tally, k: i32, loud: boolean): void => {
  t.label = `run ${k}`;
  const base = Arena.used();
  using a = arena();
  const xs = fill(k);
  if (loud) {
    return report(base);
  }
  return quiet(xs.length);
};

export const main = (): void => {
  const t = new Tally();
  run(t, 1000, true);
  run(t, 1000, false);
  console.log(t.label);
};
