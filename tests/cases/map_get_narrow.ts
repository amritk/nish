// WP32 (docs/wp32-map.md §3.2): a `const` bound to `get` reads as `V` where a
// test proves it present, by the nullable narrowing rules with `undefined` in
// place of `null`: inside `!== undefined`, after `=== undefined` that returns,
// on the right of `&&`, in a ternary's arm, and either way round.
const lookup = (m: Map<string, number>, k: string): number => {
  const v = m.get(k);
  if (v === undefined) {
    return -1;
  }
  return v * 10;
};

export const main = (): i32 => {
  const m = new Map<string, number>();
  m.set("a", 1).set("b", 2);
  const a = m.get("a");
  if (a !== undefined) {
    console.log(`a ${a}`);
  } else {
    console.log("no a");
  }
  const z: number | undefined = m.get("z");
  if (undefined === z) {
    console.log("no z");
  }
  const b = m.get("b");
  const big = b !== undefined && b > 1;
  const shown = b === undefined ? 0 : b + 100;
  console.log(`${big} ${shown} ${lookup(m, "b")} ${lookup(m, "q")}`);
  // A `const` whose value is loaded already defaults with one `select`.
  console.log(`${a ?? 7} ${z ?? 7}`);
  console.log(`${m.get("a") !== undefined} ${(m.get("q")) === undefined}`);
  return 0;
};
