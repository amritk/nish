// WP27 S2 x WP18: a `CPtr` as the type argument of a generic class. WP18
// monomorphises, so `Box<CPtr>` becomes a class with a `CPtr` field -- and the
// placement rule refuses it there, without generics needing to know the type
// exists. That is the whole point of refusing `CPtr` where it would reach
// memory the arena owns rather than teaching each pass to skip it: a construct
// added after the rule inherits the rule. The case is here because that
// composition is not visible from either feature on its own.
class Box<T> {
  value: T;
}

export const main = (): i32 => {
  const b = new Box<CPtr>();
  return 0;
};
