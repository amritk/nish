// An `f32` key of -0 is stored as +0, as JavaScript stores a -0 key: `insertAt`
// adds `fadd float %key, 0.0` before the push, so a walk yields +0 and
// `1 / key` is Infinity, by every insert path: `set`, `add`, a fused update,
// both guarded inserts and `getOrInsert` from `nish/map`. The expected stdout
// is Node's for the same values.
import { getOrInsert } from "nish/map";

const count = (m: Map<f32, i32>, k: f32): void => {
  m.set(k, (m.get(k) ?? 0) + 1);
};

const firstValue = (m: Map<f32, i32>, k: f32, v: i32): void => {
  if (!m.has(k)) {
    m.set(k, v);
  }
};

const firstOnly = (s: Set<f32>, k: f32): void => {
  if (!s.has(k)) {
    s.add(k);
  }
};

export const main = (): i32 => {
  const zero: f32 = 0.0;
  const one: f32 = 1.0;
  const m = new Map<f32, i32>();
  m.set(-zero, 1);
  for (const k of m.keys()) {
    console.log(`map ${k} ${one / k} ${m.get(zero) ?? -1}`);
  }
  const s = new Set<f32>();
  s.add(-zero);
  s.add(zero);
  for (const v of s) {
    console.log(`set ${v} ${one / v} ${s.size}`);
  }
  const counts = new Map<f32, i32>();
  count(counts, -zero);
  count(counts, zero);
  for (const k of counts.keys()) {
    console.log(`update ${one / k} ${counts.get(k) ?? -1}`);
  }
  const firsts = new Map<f32, i32>();
  firstValue(firsts, -zero, 7);
  firstValue(firsts, zero, 8);
  for (const k of firsts.keys()) {
    console.log(`guarded set ${one / k} ${firsts.get(k) ?? -1}`);
  }
  const seen = new Set<f32>();
  firstOnly(seen, -zero);
  firstOnly(seen, zero);
  for (const v of seen) {
    console.log(`guarded add ${one / v} ${seen.size}`);
  }
  const ids = new Map<f32, i32>();
  const id = getOrInsert(ids, -zero, 5) + getOrInsert(ids, zero, 6);
  for (const k of ids.keys()) {
    console.log(`getOrInsert ${one / k} ${id}`);
  }
  return 0;
};
