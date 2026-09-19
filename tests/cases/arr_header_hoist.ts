// WP15 §2c candidate 2: an array held in a class field has its header lifted
// into the loop's preheader, so the loop reads `len` and `data` once rather
// than on every pass.
//
// The shape is the one §2c names — `knownAtMost` in `self/bounds.ts` is it
// verbatim — and it is the one the §2b alias domains do *not* already fix:
// there the header load sits in a bounds-checked block, where LLVM may not
// speculate it out. `fieldScale` is that loop; `constScale` is the hoist a
// programmer writes by hand, and the two must now emit the same loop.
//
// `tests/run.js` pins what a golden cannot say in words: no header-domain load
// is left inside `@fieldScale`'s loop, and the `len` the `while` condition
// compares against is the *same SSA value* the bounds check compares against.
// That second half is §2c's criterion and the reason the first half alone is
// not enough — two lengths are two loop exits, whatever they were loaded from.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const fieldScale = (dst: i32[], h: Holder): void => {
  let i = 0;
  while (i < h.xs.length) {
    dst[i] = h.xs[i] * 2;
    i = i + 1;
  }
};

export const constScale = (dst: i32[], h: Holder): void => {
  const xs = h.xs;
  let i = 0;
  while (i < xs.length) {
    dst[i] = xs[i] * 2;
    i = i + 1;
  }
};

// A `push` in the loop moves `len`, so nothing here may be hoisted: the header
// this reads is the one it is growing.
export const grown = (h: Holder): i32 => {
  let i = 0;
  while (i < 3) {
    h.xs.push(i);
    i = i + 1;
  }
  return h.xs.length;
};

// A `Holder | null` narrowed by a guard *inside* the loop. The hoist would put
// the field load in the preheader, which is outside that guard, so this must
// not be hoisted at all: `scan(null, 0)` runs the loop zero times and nothing
// may dereference `h` on the way in. The path is refused on the *declared*
// type, because the type the checker records at the use site is the narrowed
// one and reading that answer is how this compiled to a null dereference.
export const guarded = (h: Holder | null, n: i32): i32 => {
  let s = 0;
  let i = 0;
  while (i < n) {
    if (h !== null) {
      s = s + h.xs[i];
    }
    i = i + 1;
  }
  return s;
};

export const test = (): i32 => {
  const src = [1, 2, 3, 4];
  const dst = new Array<i32>(4);
  fieldScale(dst, new Holder(src));
  const a = dst[0] + dst[1] + dst[2] + dst[3];
  constScale(dst, new Holder(src));
  const b = dst[0] + dst[1] + dst[2] + dst[3];
  return a + b + grown(new Holder([0])) + guarded(null, 0) + guarded(new Holder(src), 4);
};
