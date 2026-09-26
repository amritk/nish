import { getOrInsert, reserve } from "nish/map";

export const idOf = (ids: Map<string, i32>, w: string): i32 => getOrInsert(ids, w, ids.size);

export const presize = (ids: Map<string, i32>, n: i32): void => {
  reserve(ids, n);
};
