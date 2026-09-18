// WP18 §4a: "one diagnostic" is per offending *annotation*, not per program.
// Both fields name a type that grows, so both are refused and both spans are
// named — which is the whole value of answering the first refusal with the
// ancestor instead of throwing the rest of the member collection away.
class Nest<T> {
  first: Nest<T[]> | null;
  second: Nest<T[]> | null;
  constructor() {
    this.first = null;
    this.second = null;
  }
}

export const test = (): number => {
  const n = new Nest<i32>();
  return n.first === null && n.second === null ? 0 : 1;
};
