// WP18 G8 (§14 q7): a method of a *non-generic* class may declare its own type
// parameters, inferred from its arguments like a generic function's. `pick` at
// `i32` and at `string` is two defines, `@Chooser.pick$i32` and
// `@Chooser.pick$str`, each the method somebody would have written for that
// type with `this` first — `tests/run.js` holds the `i32` one byte-identical to
// a hand-written `pickI32`, symbol aside. A second call at `i32` asks for the
// same instantiation and adds nothing.
class Chooser {
  flip: boolean = false;

  pick<T>(a: T, b: T): T {
    return this.flip ? b : a;
  }
}

export const test = (): number => {
  const c = new Chooser();
  const first: i32 = c.pick(1, 2);
  c.flip = true;
  const word: string = c.pick("left", "right");
  console.log(word);
  return first + c.pick(10, 20);
};
