// WP32 S5 (docs/wp32-map.md §9.2): `getOrInsert` and `reserve` called from a
// generic function are lowered in place in each instantiation, as they are in
// a plain one.
import { getOrInsert, reserve } from "nish/map";

const intern = <K>(ids: Map<K, number>, key: K): number => {
  reserve(ids, 16);
  return getOrInsert(ids, key, ids.size);
};

export const main = (): i32 => {
  const names = new Map<string, number>();
  const codes = new Map<number, number>();
  console.log(`${intern(names, "x")} ${intern(names, "y")} ${intern(names, "x")} ${names.size}`);
  console.log(`${intern(codes, 40)} ${intern(codes, 40)} ${intern(codes, 2)} ${codes.size}`);
  return 0;
};
