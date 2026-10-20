// A field initializer with an empty explicit constructor: the prologue stores
// it, so the constructor writes through `this`, which is not `readonly`, and
// the constructor is not `readnone` (#740).
class Dn {
  n: i32 = 7;
  constructor() {}
}

export const main = (): i32 => {
  console.log(new Dn().n);
  return 0;
};
