// `bitsToF64` reads 64 bits, so an f64 argument is a mistake, not a conversion.
export const test = (x: f64): f64 => {
  return bitsToF64(x);
};
