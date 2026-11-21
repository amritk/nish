// WP28 C1, `optional-chaining`: a `?.` call that is a loop's whole body, or a
// branch's first statement, is the shape several of the compiler's loop and
// table matchers rewrite. Each one leaves a `?.` chain to the chain, which
// skips its call on every pass where the receiver is missing, as in Node.

class Box {
  xs: i32[];
  constructor() {
    this.xs = [1, 2, 3];
  }
}

// A counted loop that only appends: the append-range matcher.
const copy = (dst: i32[] | null, src: i32[], n: i32): void => {
  for (let j: i32 = 0; j < n; j++) dst?.push(src[j]);
};

// An `x + i` in the loop body: the add-guard matcher.
const offsets = (dst: i32[] | null, base: i32, n: i32): void => {
  for (let i: i32 = 0; i < n; i++) dst?.push(base + i);
};

// A `for...of` whose body is the one call.
const doubled = (dst: i32[] | null, src: i32[]): void => {
  for (const x of src) dst?.push(x * 2);
};

// A `Map.set` and a `Set.add` as whole statements, through a `?.`. With no
// `has` or `get` beside them they reach no matcher: the lookup-fusion
// matcher's shapes are `compat_optional_chain_fusion`.
const put = (m: Map<string, i32> | null, k: string, v: i32): void => {
  m?.set(k, v);
};
const mark = (s: Set<string> | null, k: string): void => {
  s?.add(k);
};

// An array method through a field: the field-use and lend-in-place matchers.
const clear = (b: Box | null): void => {
  b?.xs.fill(0);
};

export const main = (): void => {
  const src: i32[] = [1, 2, 3];
  const d: i32[] = [];
  copy(d, src, 3);
  copy(null, src, 3);
  offsets(d, 10, 2);
  offsets(null, 10, 2);
  doubled(d, [7, 8]);
  doubled(null, [7, 8]);
  console.log(`${d.length} ${d[0]} ${d[3]} ${d[6]}`);
  const m = new Map<string, i32>();
  put(m, "a", 1);
  put(null, "b", 2);
  const s = new Set<string>();
  mark(s, "x");
  mark(null, "y");
  console.log(`${m.get("a") ?? -1} ${m.size} ${s.size}`);
  const b = new Box();
  clear(b);
  clear(null);
  console.log(`${b.xs[0]} ${b.xs[2]}`);
};
