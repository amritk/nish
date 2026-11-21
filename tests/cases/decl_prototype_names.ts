// Every name here is also a member of JavaScript's `Object.prototype`. The
// validator, checker and emitter are all dispatch tables keyed by identifier,
// and a plain object literal inherits from `Object.prototype` — so before
// `src/lookup.ts` these compiled to `error: function valueOf() { [native code] }`.
// Nish has no prototypes, so these are ordinary names and must stay so.
class toString {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
}

const valueOf = (x: i32): i32 => {
  return x * 2;
};

const hasOwnProperty = (x: i32): i32 => {
  return x + 1;
};

const isPrototypeOf = (x: i32): i32 => {
  return x - 1;
};

export const main = (): number => {
  const constructor: i32 = 3;
  console.log(valueOf(21));
  console.log(hasOwnProperty(41));
  console.log(isPrototypeOf(11));
  console.log(new toString(7).n);
  console.log(constructor);
  return 0;
};
