// WP18 G8: a constructor takes its class's type arguments, written after `new`,
// and has none of its own — TypeScript refuses `constructor<T>()` as well. The
// parser refuses it (tests/self/parser_refusals.txt), because the
// `typescript` package parses the list and leaves the rule to its checker.
class Holder {
  value: i32 = 0;

  constructor<T>(x: T) {
    this.value = 1;
  }
}

export const test = (): number => new Holder(1).value;
