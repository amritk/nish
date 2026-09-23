// WP18 G8: an instantiation of a generic method of an exported class is an
// ordinary method whose symbol holds a `$`, so every sidecar spells it the way
// it spells a generic function's instantiation. The header declares
// `nish_gen_Holder_pick_i32`, bound to `@Holder.pick$i32` with `NISH_SYMBOL`,
// and says which method it instantiates; the JavaScript sidecars bridge no
// method, generic or not, because `this` is a struct pointer.
export class Holder {
  flip: boolean = false;

  pick<T>(a: T, b: T): T {
    return this.flip ? b : a;
  }
}

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  with<U>(other: U): T {
    return this.value;
  }
}

export const run = (h: Holder): i32 => {
  const s: string = h.pick("a", "b");
  const b = new Box<i32>(s.length);
  return h.pick(1, 2) + b.with(true);
};
