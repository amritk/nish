// WP32 (§3.1 J): TS2322 under `tsc`; the annotation is `i32 | undefined`, or none.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const j: i32 = m.get("a");
  return j;
};
