// `declare class` promises a layout from elsewhere, and there is no elsewhere —
// least of all for a template, whose layout does not exist until `T` is bound.
declare class Box<T> {
  value: T;
}
