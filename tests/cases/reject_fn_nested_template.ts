// A nested function in a generic function nothing instantiates, and in a
// method of a generic class. A template's body is checked once per
// instantiation, so NL2260 is a sweep over the whole module in pass 1.
const each = <T>(xs: T[]): i32 => {
  function inner(): i32 {
    return 1;
  }
  return inner();
};

class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }

  size(): i32 {
    if (true) {
      function one(): i32 {
        return 1;
      }
    }
    return 1;
  }
}

export const main = (): i32 => 0;
