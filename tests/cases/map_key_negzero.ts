// A -0 key is stored as +0, as ECMA-262's `Map.prototype.set` (step 5) and
// `Set.prototype.add` (step 4) store it, so a walk over the keys yields +0 and
// `1 / key` is Infinity. The store is `insertAt`'s, which every insert path
// reaches: `set`, `add`, a fused update, both guarded inserts, and
// `getOrInsert` from `nish/map`. Node runs this file unmodified with its own
// `Map` and `Set` (`tests/differential/unmodified.js`), and the two must print
// the same.
import { getOrInsert } from "nish/map";

const count = (m: Map<number, number>, k: number): void => {
  m.set(k, (m.get(k) ?? 0) + 1);
};

const firstOnly = (s: Set<number>, k: number): void => {
  if (!s.has(k)) {
    s.add(k);
  }
};

const firstValue = (m: Map<number, number>, k: number, v: number): void => {
  if (!m.has(k)) {
    m.set(k, v);
  }
};

export const main = (): i32 => {
  const z = 0;
  const set = new Map<number, number>();
  set.set(-z, 1);
  for (const k of set.keys()) {
    console.log(`set ${k} ${1 / k}`);
  }
  const add = new Set<number>();
  add.add(-z);
  add.add(z);
  for (const v of add) {
    console.log(`add ${v} ${1 / v} ${add.size}`);
  }
  const plusFirst = new Map<number, string>();
  plusFirst.set(z, "plus").set(-z, "minus");
  const minusFirst = new Map<number, string>();
  minusFirst.set(-z, "minus").set(z, "plus");
  for (const k of plusFirst.keys()) {
    console.log(`plus first ${1 / k} ${plusFirst.get(k) ?? "none"}`);
  }
  for (const k of minusFirst.keys()) {
    console.log(`minus first ${1 / k} ${minusFirst.get(k) ?? "none"}`);
  }
  const counts = new Map<number, number>();
  count(counts, -z);
  count(counts, z);
  for (const k of counts.keys()) {
    console.log(`update ${1 / k} ${counts.get(k) ?? -1}`);
  }
  const seen = new Set<number>();
  firstOnly(seen, -z);
  firstOnly(seen, z);
  for (const v of seen) {
    console.log(`guarded add ${1 / v} ${seen.size}`);
  }
  const firsts = new Map<number, number>();
  firstValue(firsts, -z, 7);
  firstValue(firsts, z, 8);
  for (const k of firsts.keys()) {
    console.log(`guarded set ${1 / k} ${firsts.get(k) ?? -1}`);
  }
  const ids = new Map<number, number>();
  const id = getOrInsert(ids, -z, 3) + getOrInsert(ids, z, 4);
  for (const k of ids.keys()) {
    console.log(`getOrInsert ${1 / k} ${id}`);
  }
  const nan = new Set<number>();
  nan.add(z / z);
  nan.add(-(z / z));
  for (const v of nan) {
    console.log(`nan ${v} ${nan.size}`);
  }
  return 0;
};
