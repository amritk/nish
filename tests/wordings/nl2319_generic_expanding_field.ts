// NL2319: the struct half of the termination rule (WP18 §4). A field whose
// type puts the class's own type argument under a constructor asks for a
// strictly larger instantiation, so the chain has no end, and the sentence
// names the two shapes that do terminate rather than a depth — the fix is to
// change the annotation, not to raise a limit.
//
// `tests/cases/reject_generic_expanding_field` already pins these words. What
// this corpus adds is the *code*: `tests/diagnostic_coverage.js` reads the
// `--json` object and fails if the message comes out NL0000, or under a
// number other than the one the registry froze, which is what a reword would
// do to it.
class Nest<T> {
  inner: Nest<T[]> | null;
  constructor() {
    this.inner = null;
  }
}

export const main = (): i32 => {
  const n = new Nest<i32>();
  return n.inner === null ? 0 : 1;
};
