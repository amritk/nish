// #234, the `T | null` twin of reject_result_ternary_keeps_proof: a ternary's
// type never carries an arm's proof. `r` is narrowed to non-null and `q` to
// `null`; the arms' types differ only in that proof, so `z` is a plain
// `Box | null` and reading its field needs a test of `z` itself.
class Box {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

const mk = (some: boolean): Box | null => (some ? new Box(7) : null);

export const main = (): void => {
  const r = mk(true);
  const q = mk(false);
  if (r !== null) {
    if (q === null) {
      const z = r.v > 0 ? r : q;
      console.log(`${z.v}`);
    }
  }
};
