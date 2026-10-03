// WP33 NL8002, the loud counterpart of `port_str_slice_literal_quiet` (#326): a
// literal receiver's length proves only the bounds inside it. A bound past the
// end, written or held in a `const`, a reversed pair of bounds that are each
// inside it (`5, 0` among them, whose `0` every string proves), a pair a guard
// cannot order, a `let` that may be rebound, and a non-ASCII literal (two bytes
// here, one code unit in TypeScript, which clamps the `2`) each stay reported.
// The first seven never run, because the first five would panic.
const never = (): boolean => false;

// `k` is inside `[0, 4]`, but nothing says it is at least 3.
const upTo = (k: number): string => {
  if (k >= 0 && k <= 4) {
    return "abcdef".slice(3, k);
  }
  return "";
};

export const main = (): number => {
  const t = "abcdef";
  let v = "abcdef";
  if (never()) {
    console.log(t.slice(1, 7));
    const far = 7;
    console.log(t.slice(far));
    console.log("abcdef".slice(5, 2));
    console.log(t.slice(5, 2));
    console.log(t.slice(5, 0));
    console.log(upTo(4));
    console.log("é".slice(0, 2));
    v = "";
  }
  console.log(v.slice(1, 3));
  return 0;
};
