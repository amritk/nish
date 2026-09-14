// WP6, one source line and two memory behaviours: the escape analysis runs per
// instantiation because it is keyed by symbol, so `hold<i32>` keeps its box in
// an entry-block `alloca` while `hold<string>` has to bump the arena because
// the box it builds is returned. Nothing was added to make that happen
// (WP18 §6.4).
class Box<T> {
  value: T;
  constructor(v: T) {
    this.value = v;
  }
}

const sumOf = (v: i32): i32 => {
  const local = new Box<i32>(v);
  return local.value;
};

const escaping = (v: string): Box<string> => new Box<string>(v);

export const test = (): number => {
  console.log(escaping("kept").value);
  return sumOf(7);
};
