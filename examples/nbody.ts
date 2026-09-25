// Adapted from the Computer Language Benchmarks Game n-body program (Node.js #6,
// contributed by Isaac Gouy, modified by Andrey Filatkin),
// https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
// Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
// Revised BSD licence; see bench/LICENSE-benchmarksgame.md.
// smoke: args --number-mode f64
class Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
  constructor(x: number, y: number, z: number, vx: number, vy: number, vz: number, mass: number) {
    this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.mass = mass;
  }
}

const advance = (bodies: Body[], dt: number): void => {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const bi = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const bj = bodies[j];
      const dx = bi.x - bj.x;
      const dy = bi.y - bj.y;
      const dz = bi.z - bj.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const mag = dt / (d2 * Math.sqrt(d2));
      bi.vx = bi.vx - dx * bj.mass * mag;
      bi.vy = bi.vy - dy * bj.mass * mag;
      bi.vz = bi.vz - dz * bj.mass * mag;
      bj.vx = bj.vx + dx * bi.mass * mag;
      bj.vy = bj.vy + dy * bi.mass * mag;
      bj.vz = bj.vz + dz * bi.mass * mag;
    }
  }
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    b.x = b.x + dt * b.vx;
    b.y = b.y + dt * b.vy;
    b.z = b.z + dt * b.vz;
  }
};

const energy = (bodies: Body[]): number => {
  let e = 0;
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const bi = bodies[i];
    e = e + 0.5 * bi.mass * (bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz);
    for (let j = i + 1; j < n; j++) {
      const bj = bodies[j];
      const dx = bi.x - bj.x;
      const dy = bi.y - bj.y;
      const dz = bi.z - bj.z;
      e = e - (bi.mass * bj.mass) / Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return e;
};

export const main = (): i32 => {
  const PI = Math.PI;
  const SOLAR_MASS = 4 * PI * PI;
  const DAYS = 365.24;
  const bodies: Body[] = [
    new Body(0, 0, 0, 0, 0, 0, SOLAR_MASS),
    new Body(4.841431442464721, -1.1603200440274284, -0.10362204447112311, 0.001660076642744037 * DAYS, 0.007699011184197404 * DAYS, -0.0000690460016972063 * DAYS, 0.0009547919384243266 * SOLAR_MASS),
    new Body(8.34336671824458, 4.124798564124305, -0.4035234171143214, -0.002767425107268624 * DAYS, 0.004998528012349172 * DAYS, 0.000023041729757376393 * DAYS, 0.0002858859806661308 * SOLAR_MASS),
    new Body(12.894369562139131, -15.111151401698631, -0.22330757889265573, 0.002964601375647616 * DAYS, 0.0023784717395948095 * DAYS, -0.000029658956854023756 * DAYS, 0.00004366244043351563 * SOLAR_MASS),
    new Body(15.379697114850917, -25.919314609987964, 0.17925877295037118, 0.0026806777249038932 * DAYS, 0.001628241700382423 * DAYS, -0.00009515922545197159 * DAYS, 0.000051513890204661145 * SOLAR_MASS),
  ];
  let px = 0; let py = 0; let pz = 0;
  for (let i = 0; i < bodies.length; i++) {
    px = px + bodies[i].vx * bodies[i].mass;
    py = py + bodies[i].vy * bodies[i].mass;
    pz = pz + bodies[i].vz * bodies[i].mass;
  }
  bodies[0].vx = -px / SOLAR_MASS;
  bodies[0].vy = -py / SOLAR_MASS;
  bodies[0].vz = -pz / SOLAR_MASS;
  console.log(`${energy(bodies)}`);
  for (let k = 0; k < 1000; k++) advance(bodies, 0.01);
  console.log(`${energy(bodies)}`);
  return 0;
};
