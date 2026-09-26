// WP32 S5 (docs/wp32-map.md §9.2): the count `reserve` takes is a `number`.
import { reserve } from "nish/map";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  reserve(m, "10");
  return 0;
};
