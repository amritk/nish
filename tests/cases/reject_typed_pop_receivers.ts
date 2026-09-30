// WP33 R2: every receiver docs/LANGUAGE.md lists carries the spelling: a field,
// a call whose declared return type is the name, `new` itself, a copy of a
// spelled binding, a `type` alias of the name, and the name in `| null`.
type Samples = Float64Array;

class Buffer {
  data: Float64Array;
  constructor(n: i32) {
    this.data = new Float64Array(n);
  }
}

const make = (n: i32): Int32Array => new Int32Array(n);

export const test = (): number => {
  const b = new Buffer(2);
  b.data.pop();
  make(2).pop();
  new Float32Array(2).pop();
  const copy = b.data;
  copy.pop();
  const s: Samples = new Float64Array(2);
  s.pop();
  const n: BigInt64Array | null = new BigInt64Array(1);
  if (n !== null) {
    n.pop();
  }
  return 0;
};
