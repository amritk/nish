// A type parameter takes no type arguments: `T` is whatever the instantiation
// bound it to, and `T<i32>` is not that type. The type-argument guard therefore
// sits above the type-parameter lookup, so writing one is refused rather than
// silently answering `T` and dropping what was written (WP18 G5).
const ident = <T,>(x: T): T => {
  const y: T<i32> = x;
  return x;
};

export const test = (): number => ident(7);
