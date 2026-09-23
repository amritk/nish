// NL2328: a type argument that does not satisfy its parameter's constraint
// (WP18 §8 message 1), here a class constraint. Nothing but `Counter` itself
// satisfies `T extends Counter`, because a class can only `implements` an
// interface, so the fix names the class.
class Counter {
  count: i32 = 0;
}

class Gauge {
  count: i32 = 0;
}

const countOf = <T extends Counter>(c: T): i32 => c.count;

export const main = (): i32 => countOf(new Gauge());
