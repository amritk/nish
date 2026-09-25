// WP32: the maybe spelling does not make a scalar nullable: `i32 | null` is refused inside it too.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const a: i32 | null | undefined = m.get("a");
  return 0;
};
