// WP33 R2: `BigInt64Array` has a fixed length in TypeScript, so `push` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: BigInt64Array = new BigInt64Array(2);
  const v: i64 = 7;
  xs.push(v);
  return xs.length;
};
