// NL2702: A spread copies each field as it is, so a field's type in the source and the
// target must be the same.
interface Wide {
  x: i64;
}

interface Narrow {
  x: i32;
}

export const main = (): i32 => {
  const a: Narrow = { x: 1 };
  const w: Wide = { ...a };
  return 0;
};
