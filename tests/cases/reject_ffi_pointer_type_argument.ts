// WP27 S2 x WP18: a `CPtr` as the type argument of a generic class. WP18
// monomorphises, so `Box<CPtr>` would become a class with a `CPtr` field. The
// argument is refused where the class is instantiated, as it is for a generic
// function, so a template that never mentions `T` in a member
// (`class Empty<T> { n: i32 = 0; }`) is refused too, and `Box<CPtr>` never
// reaches the handle class rules of WP40 §4a.
class Box<T> {
  value: T;
}

export const main = (): i32 => {
  const b = new Box<CPtr>();
  return 0;
};
