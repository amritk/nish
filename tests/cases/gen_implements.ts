// `implements` on a generic class names an instantiated interface, and the
// check is the ordinary prefix one against `Container$i32` — the interface's
// fields are the class's first fields, so a `%struct.Box$i32*` is a
// `%struct.Container$i32*` after one `bitcast` (WP25, WP18 §6.3).
interface Container<T> {
  value: T;
}

class Box<T> implements Container<T> {
  value: T;
  extra: i32;
  constructor(v: T) {
    this.value = v;
    this.extra = 1;
  }
}

const valueOf = (c: Container<i32>): i32 => c.value;

export const test = (): number => {
  const b = new Box<i32>(41);
  return valueOf(b) + b.extra;
};
