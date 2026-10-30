// A vector is a value: kept in a local, a field, an array slot and a Map's
// value, passed and returned, and copied by assignment.
import { i32x4, f64x2, splatI32x4, extract, replace } from "nish:simd";

class Particle {
  id: i32;
  pos: f64x2;
  vel: f64x2;
  constructor(id: i32, pos: f64x2, vel: f64x2) {
    this.id = id;
    this.pos = pos;
    this.vel = vel;
  }
}

const sum4 = (v: i32x4): i32 => extract(v, 0) + extract(v, 1) + extract(v, 2) + extract(v, 3);

const bump = (v: i32x4): i32x4 => replace(v, 0, extract(v, 0) + 1);

export const main = (): number => {
  const rows: i32x4[] = [];
  for (let i = 0; i < 3; i++) {
    rows.push(i32x4(i, i * 2, i * 3, i * 4));
  }
  rows[1] = bump(rows[1]);
  let total = 0;
  for (const r of rows) {
    total += sum4(r);
  }
  console.log(total);
  const p = new Particle(1, f64x2(0.5, 1.5), f64x2(0.25, -0.25));
  p.pos = f64x2(extract(p.pos, 0) + extract(p.vel, 0), extract(p.pos, 1) + extract(p.vel, 1));
  console.log(extract(p.pos, 0));
  console.log(extract(p.pos, 1));
  let v = splatI32x4(9);
  const kept = v;
  v = bump(v);
  console.log(sum4(kept));
  console.log(sum4(v));
  const named = new Map<i32, i32x4>();
  named.set(7, v);
  const got = named.get(7);
  if (got !== undefined) {
    console.log(sum4(got));
  }
  console.log(named.get(8) === undefined);
  return 0;
};
