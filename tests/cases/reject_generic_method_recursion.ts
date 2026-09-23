// WP18 G8: a generic method's request joins the chain a generic function's
// does, so polymorphic recursion through a method is refused with §4's
// sentence: `walk<i32>` asks for `walk<i32[]>`, which asks for `walk<i32[][]>`,
// and the chain has no end.
class Walker {
  depth: i32 = 0;

  walk<T>(x: T, n: i32): i32 {
    if (n === 0) {
      return this.depth;
    }
    return this.walk([x], n - 1);
  }
}

export const test = (): number => new Walker().walk(1, 3);
