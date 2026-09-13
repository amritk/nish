// WP18: one generic function, two instantiations. The golden pins the `$`
// symbols and the fact that `identity$str` has no `nocapture` on its parameter
// — returning the pointer is an escape — while `identity$i32` takes a scalar
// and has nothing to say about memory at all.
const identity = <T>(x: T): T => x;

export const test = (): number => {
  console.log(identity(7));
  console.log(identity("hi"));
  return 0;
};
