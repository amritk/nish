// An `f32` key of -0 is stored as +0, as JavaScript stores a -0 key: `insertAt`
// adds `fadd float %key, 0.0` before the push, so a walk yields +0 and
// `1 / key` is Infinity for a `Map` and a `Set` alike. The expected stdout is
// Node's for the same values.
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
  return 0;
};
