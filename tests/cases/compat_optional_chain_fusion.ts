// WP28 C1, `optional-chaining`: the lookup-fusion matcher folds a `Map.set`
// whose value asks `has` about the same key into one probe of the table. A
// call in a `?.` chain is never fused: its receiver may be missing, and a
// fused probe would read the table before the `?.` tested it. Each shape runs
// with the table there and with it `null`.

// An update: the `set` and the `has` in its value name one table, a
// parameter, and one key. Without the `?.` exclusion in `collectionOwnerOf`
// this is the shape the matcher fuses, and the emitter has no null test to
// put the probe behind.
const flip = (m: Map<string, number> | null, k: string): void => {
  m?.set(k, (m?.has(k) ?? false) ? 2 : 1);
};

// A guard: the branch starts with the write of the key the condition asks
// about. The strict `m.has(k)` condition has no `?.` form either dialect
// admits, so the condition is the `??` one, which is not a `has` call and so
// never reaches the guard matcher; the case pins that it still runs right.
const bump = (m: Map<string, number> | null, k: string): void => {
  if (m?.has(k) ?? false) m?.set(k, 10);
};

// A `Set` written under a negated guard, the same way.
const mark = (s: Set<string> | null, k: string): void => {
  if (!(s?.has(k) ?? false)) s?.add(k);
};

export const main = (): void => {
  const m = new Map<string, number>();
  const s = new Set<string>();
  flip(m, "a");
  flip(m, "a");
  flip(m, "b");
  flip(null, "a");
  bump(m, "b");
  bump(m, "c");
  bump(null, "b");
  mark(s, "x");
  mark(s, "x");
  mark(null, "x");
  console.log(`${m.get("a") ?? -1} ${m.get("b") ?? -1} ${m.get("c") ?? -1} ${m.size} ${s.size}`);
};
