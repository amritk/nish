// The point of the annotation at the ABI boundary: `const amrit_array *` on the
// C prototype used to be a *consequence* — the whole-program fixpoint proved
// nothing stored through the pointer — and for a `readonly T[]` it is the
// signature keeping a promise instead. The two mechanisms have to agree, and
// `writtenArrayParams` fails the build (exit 70) if they ever do not.
//
// No `main`: with an entry point every other function is internal and the
// header has nothing to declare.
export function sum(xs: readonly i32[]): i32 {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
}

export function fill(xs: i32[], v: i32): void {
  let i = 0;
  while (i < xs.length) {
    xs[i] = v;
    i = i + 1;
  }
}
