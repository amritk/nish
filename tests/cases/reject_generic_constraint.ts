// `<T extends Shape>` needs member access on a type parameter, which is its own
// rule and its own milestone (WP18 §6.5, G6). Until then a type parameter is
// passed on, returned and stored, and nothing else.
interface Shape {
  area: i32;
}

const biggest = <T extends Shape>(a: T): i32 => a.area;

export const test = (): number => 0;
