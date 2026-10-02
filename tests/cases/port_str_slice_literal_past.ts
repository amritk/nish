// WP33 NL8002, the loud counterpart of `port_str_slice_literal_quiet` (#326): a
// literal receiver's length proves only the bounds inside it. A bound past the
// end, written or held in a `const`, a `let` that may be rebound, and a
// non-ASCII literal — two bytes here, one code unit in TypeScript, which clamps
// the `2` — each stay reported. The first three never run, because the first
// two would panic.
const never = (): boolean => false;

export const main = (): number => {
  const t = "abcdef";
  let v = "abcdef";
  if (never()) {
    console.log(t.slice(1, 7));
    const far = 7;
    console.log(t.slice(far));
    console.log("é".slice(0, 2));
    v = "";
  }
  console.log(v.slice(1, 3));
  return 0;
};
