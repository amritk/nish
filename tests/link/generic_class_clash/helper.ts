// The other half: the same template name, a different field list, and an
// exported function whose *return type* hands the entry a value of it.
class Holder<T> {
  lead: i32;
  value: T;

  constructor(v: T) {
    this.lead = 118;
    this.value = v;
  }
}

export const make = (): Holder<i32> => new Holder<i32>(229);
