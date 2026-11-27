// WP15 §8: `NL9008` must be silent for a `declare function`, and must still
// fire for the ordinary shape in the same loop. Both are here so that the
// guard cannot be widened into silence without a golden moving.
//
// `abs` is external because C defines it, not because this module withheld an
// `export`. Neither rewrite the message names helps it: an `export declare
// function` (WP89 S3b) only lends the binding to the modules that import it
// and still defines nothing, and dropping `--no-strict-exports` would not make
// it `internal`, because there is no body here to give linkage to -- the
// `declare` line below is the same under the flag as under the default.
// Testing `exported` alone reported it, because this binding is not exported;
// the guard is `FunctionSig.foreign`, the predicate for this distinction.
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
