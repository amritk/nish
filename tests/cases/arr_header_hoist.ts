// WP15 §2c candidate 2: an array held in a class field has its header lifted
// into the loop's preheader, so the loop reads `len` and `data` once rather
// than on every pass.
//
// The shape is the one §2c names — `knownAtMost` in `self/bounds.ts` is it
// verbatim — and it is the one the §2b alias domains do *not* already fix:
// there the header load sits in a bounds-checked block, where LLVM may not
// speculate it out. `fieldScale` is that loop and `constScale` is the hoist a
// programmer writes by hand, and after this the two read their headers the same
// way — but they are still *not* the same loop, and the check below says so:
// `constScale` carries one bounds check and `fieldScale` two, because
// `checker/bounds.ts` keys its length facts by variable and never by a property
// path, so `h.xs.length` proves nothing about `h.xs[i]`. That second check is
// the second loop exit, and closing it is that file's work rather than the
// emitter's.
//
// `tests/run.js` pins what a golden cannot say in words: no header-domain load
// is left inside `@fieldScale`'s loop, and the `len` the `while` condition
// compares against is the *same SSA value* the bounds check compares against.
// That second half is §2c's criterion and the reason the first half alone is
// not enough — two lengths are two loop exits, whatever they were loaded from.
// A caution for anyone measuring this shape with `bench/hoist_field.ts`: that
// benchmark's `field` number is **bimodal on code placement**, not on the loop.
// The same ten-instruction inner loop reads ~755 ms or ~1493 ms depending on
// which *other* functions in the module were hoisted, and building either
// binary with `-Wl,-mllvm,-align-all-nofallthru-blocks=4` puts both at ~754 ms.
// Quote it with that flag, or the number is a coin toss rather than a
// measurement.
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

// A store in the loop to a field the path names. The hoisted value *is* that
// field's load, so replacing it mid-loop has to refuse the hoist -- and the
// refusal is by field name, which is what lets a loop that advances `this.pos`
// still hoist `this.source`.
export const replaced = (h: Holder, other: i32[]): i32 => {
  let s = 0;
  let i = 0;
  while (i < 3) {
    s = s + h.xs[i];
    h.xs = other;
    i = i + 1;
  }
  return s;
};

// A path rooted at a local the loop itself declares: there is no value to lift
// above the declaration, because the preheader runs before it. `hs` is a
// parameter and is hoisted; `h` is not, so no `%struct.Holder` load may appear
// ahead of the loop.
export const declaredInside = (hs: Holder[], n: i32): i32 => {
  let s = 0;
  let i = 0;
  while (i < n) {
    const h = hs[0];
    s = s + h.xs[0];
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
  return (
    a +
    b +
    grown(new Holder([0])) +
    guarded(null, 0) +
    guarded(new Holder(src), 4) +
    replaced(new Holder(src), [9, 9, 9]) +
    declaredInside([new Holder(src)], 3)
  );
};
