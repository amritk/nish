// Data parallelism (wp29 P1), n-body partitioned: 1024 bodies under gravity,
// the accelerations computed as one map per step. A parallel body answers a
// number, so the map runs over one probe per body and axis — 3n elements — and
// each probe sums its body's acceleration along its axis over every other
// body. The probes reach the bodies, which are read and never written inside
// the map; the step that moves them runs on one thread afterwards. `seq` runs
// the same probes as a loop, `par` as `parallelMapInto`, and both print the
// system's energy before and after, which agree to the last bit because every
// sum is taken in the same order either way.
import { parallelMapInto } from "nish/threads";

class Body {
  x: f64;
  y: f64;
  z: f64;
  vx: f64;
  vy: f64;
  vz: f64;
  mass: f64;
  constructor(x: f64, y: f64, z: f64, mass: f64) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0.0;
    this.vy = 0.0;
    this.vz = 0.0;
    this.mass = mass;
  }
}

/** One element of the map: body `index`'s acceleration along `axis` (0, 1 or 2). */
class Probe {
  index: i32;
  axis: i32;
  bodies: Body[];
  constructor(index: i32, axis: i32, bodies: Body[]) {
    this.index = index;
    this.axis = axis;
    this.bodies = bodies;
  }
}

/** The softening keeps two bodies that pass close from producing an infinite force. */
const SOFTENING: f64 = 0.01;

const accel = (p: Probe): f64 => {
  const bodies = p.bodies;
  const i = p.index;
  if (i < 0 || i >= toI32(bodies.length)) {
    return 0.0;
  }
  const bi = bodies[i];
  let a: f64 = 0.0;
  for (let j: i32 = 0; j < toI32(bodies.length); j++) {
    const bj = bodies[j];
    const dx = bj.x - bi.x;
    const dy = bj.y - bi.y;
    const dz = bj.z - bi.z;
    const d2 = dx * dx + dy * dy + dz * dz + SOFTENING;
    const inv = bj.mass / (d2 * Math.sqrt(d2));
    const d = p.axis === 0 ? dx : p.axis === 1 ? dy : dz;
    a = a + d * inv;
  }
  return a;
};

const energy = (bodies: Body[]): f64 => {
  let e: f64 = 0.0;
  for (let i: i32 = 0; i < toI32(bodies.length); i++) {
    const bi = bodies[i];
    e = e + 0.5 * bi.mass * (bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz);
    for (let j: i32 = i + 1; j < toI32(bodies.length); j++) {
      const bj = bodies[j];
      const dx = bi.x - bj.x;
      const dy = bi.y - bj.y;
      const dz = bi.z - bj.z;
      e = e - (bi.mass * bj.mass) / Math.sqrt(dx * dx + dy * dy + dz * dz + SOFTENING);
    }
  }
  return e;
};

export const main = (): i32 => {
  const n: i32 = 1024; // bench:n
  const steps: i32 = 16;
  const dt: f64 = 0.001;
  const par = process.argv.length > 1 && process.argv[1] === "par";
  const bodies: Body[] = [];
  let seed: f64 = 0.5;
  for (let i: i32 = 0; i < n; i++) {
    // A fixed pseudo-random cloud, the same on every run and in every mode.
    seed = seed * 3.9 * (1.0 - seed);
    const x = seed * 10.0;
    seed = seed * 3.9 * (1.0 - seed);
    const y = seed * 10.0;
    seed = seed * 3.9 * (1.0 - seed);
    const z = seed * 10.0;
    bodies.push(new Body(x, y, z, 1.0 + seed));
  }
  const probes: Probe[] = [];
  for (let i: i32 = 0; i < n; i++) {
    probes.push(new Probe(i, 0, bodies));
    probes.push(new Probe(i, 1, bodies));
    probes.push(new Probe(i, 2, bodies));
  }
  const acc = new Array<f64>(toI32(probes.length));
  console.log(`${energy(bodies)}`);
  for (let s: i32 = 0; s < steps; s++) {
    if (par) {
      parallelMapInto(probes, acc, accel);
    } else {
      for (let k: i32 = 0; k < toI32(probes.length); k++) {
        const a = accel(probes[k]);
        if (k < toI32(acc.length)) {
          acc[k] = a;
        }
      }
    }
    for (let i: i32 = 0; i < toI32(bodies.length); i++) {
      const b = bodies[i];
      const k: i32 = i * 3;
      if (k >= 0 && k < toI32(acc.length) && k + 1 < toI32(acc.length) && k + 2 < toI32(acc.length)) {
        b.vx = b.vx + dt * acc[k];
        b.vy = b.vy + dt * acc[k + 1];
        b.vz = b.vz + dt * acc[k + 2];
      }
    }
    for (let i: i32 = 0; i < toI32(bodies.length); i++) {
      const b = bodies[i];
      b.x = b.x + dt * b.vx;
      b.y = b.y + dt * b.vy;
      b.z = b.z + dt * b.vz;
    }
  }
  console.log(`${energy(bodies)}`);
  return 0;
};
