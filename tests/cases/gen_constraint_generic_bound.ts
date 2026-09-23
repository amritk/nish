// WP18 G6: a constraint may be an instantiation of a generic interface, with
// its type arguments written out. `T extends Container<i32>` has the one field
// `Container$i32` declares, and `Cell` satisfies it because it
// `implements Container<i32>` (WP18 §6.5, and `gen_implements` for the prefix).
interface Container<T> {
  value: T;
}

class Cell implements Container<i32> {
  value: i32;
  label: string;

  constructor(value: i32) {
    this.value = value;
    this.label = "cell";
  }
}

const valueOf = <T extends Container<i32>>(c: T): i32 => c.value;

export const test = (): number => valueOf(new Cell(42));
