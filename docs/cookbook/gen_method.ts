class Chooser {
  flip: boolean = false;

  pick<T>(a: T, b: T): T {
    return this.flip ? b : a;
  }
}

class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  keep<U>(other: U): T {
    return this.value;
  }
}

export const main = (): i32 => {
  const c = new Chooser();
  const word: string = c.pick("left", "right");
  console.log(word);
  return c.pick(1, 2) + new Box<i32>(7).keep("seven");
};
