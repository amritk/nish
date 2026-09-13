// WP18 §5: the attribute fixpoint is keyed by symbol and each instantiation has
// its own, so one source line gets two sets of facts — `eq$i32` is `readnone`
// because comparing two integers reads nothing, and `eq$str` is `readonly`
// because it calls `nish_str_eq` over the bytes.
const eq = <T>(a: T, b: T): boolean => a === b;

export const test = (): number => {
  console.log(eq(1, 1));
  console.log(eq("a", "b"));
  return 0;
};
