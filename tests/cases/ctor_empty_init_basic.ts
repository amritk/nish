// #740: an explicit constructor whose body is empty still runs the field
// initialisers. They are stored in its prologue, outside the written body, so
// `this` is written and not `readonly`, and -O2 keeps the stores.
class Dn {
  x: f64 = 2.5;
  n: i32 = 7;
  on: boolean = true;

  constructor() {}

  // Only reads `this`: its `this` stays `readonly`.
  scaled(): f64 {
    return this.x * 2.0;
  }
}

// No initialiser to store: the empty constructor stays `readnone`.
class Bare {
  constructor() {}

  one(): i32 {
    return 1;
  }
}

export const main = (): i32 => {
  const d = new Dn();
  console.log(d.n);
  console.log(d.x);
  console.log(d.on);
  console.log(d.scaled());
  const b = new Bare();
  console.log(b.one());
  return 0;
};
