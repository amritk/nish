// WP33 R2: `BigInt64Array` has a fixed length in TypeScript, so `pop` is refused on a binding spelled with it.
export const test = (): number => {
  const xs: BigInt64Array = new BigInt64Array(2);
  xs.pop();
  return xs.length;
};
