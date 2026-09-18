// WP15 §8: `NL9008` must be silent for a `declare function`, and must still
// fire for the ordinary shape in the same loop. Both are here so that the
// guard cannot be widened into silence without a golden moving.
//
// `abs` is external because C defines it, not because this module withheld an
// `export`. Neither rewrite the message names is available for it: `export
// declare function` is refused outright (`reject_ffi_export`), and dropping
// `--no-strict-exports` would not make it `internal`, because there is no body
// here to give linkage to -- the `declare` line below is the same under the
// flag as under the default. Testing `exported` alone reported it anyway,
// because `exported` is always false for a foreign declaration; the guard is
// `FunctionSig.foreign`, the predicate that exists for this distinction.
//
// `step` is the shape that must keep warning, in the same loop and on the same
// pass, so the one reported diagnostic is the proof the guard is not too wide.
//
// The parser oracle skips this file, as it skips every `declare function` case
// (`needs FunctionDeclaration`), which is why the shape lives here rather than
// in `perf_inline_quiet`: adding it there would have dropped that file out of
// the parser comparison in silence.
declare function abs(n: i32): i32;

const step = (n: i32): i32 => n * 2 + 1;

export const test = (): number => {
  let total = 0;
  let i = 0;
  while (i < 4) {
    total = total + abs(0 - i) + step(i);
    i = i + 1;
  }
  return total;
};
