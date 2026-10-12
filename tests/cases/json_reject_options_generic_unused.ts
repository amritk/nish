// Typed JSON options on a generic class nothing instantiates: a template's
// members are collected only when it is instantiated, so the options are
// refused where the class is declared instead (NL2492).
class Box<T> {
  static readonly json = { bogus: 1 };
  v: T;

  constructor(v: T) {
    this.v = v;
  }
}

export const main = (): i32 => 0;
