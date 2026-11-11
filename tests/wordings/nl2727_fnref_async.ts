// NL2727: an async function named as a value.
const later = async (x: i32): Promise<i32> => x;

export const main = (): i32 => {
  const f = later;
  return 0;
};
