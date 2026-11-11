// NL2719: a generic function named as a value. A reference names one body,
// and a generic function has one per instantiation.
const id = <T>(x: T): T => x;

export const main = (): i32 => {
  const f = id;
  return 0;
};
