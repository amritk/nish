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

function advance(bodies: Body[], dt: number): void {
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
}

function energy(bodies: Body[]): number {
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
}

export function main(): i32 {
  const PI = 3.141592653589793;
  const SOLAR_MASS = 4 * PI * PI;
  const DAYS = 365.24;
  const bodies: Body[] = [
    new Body(0, 0, 0, 0, 0, 0, SOLAR_MASS),
    new Body(4.84143144246472090e+00, -1.16032004402742839e+00, -1.03622044471123109e-01, 1.66007664274403694e-03 * DAYS, 7.69901118419740425e-03 * DAYS, -6.90460016972063023e-05 * DAYS, 9.54791938424326609e-04 * SOLAR_MASS),
    new Body(8.34336671824457987e+00, 4.12479856412430479e+00, -4.03523417114321381e-01, -2.76742510726862411e-03 * DAYS, 4.99852801234917238e-03 * DAYS, 2.30417297573763929e-05 * DAYS, 2.85885980666130812e-04 * SOLAR_MASS),
    new Body(1.28943695621391310e+01, -1.51111514016986312e+01, -2.23307578892655734e-01, 2.96460137564761618e-03 * DAYS, 2.37847173959480950e-03 * DAYS, -2.96589568540237556e-05 * DAYS, 4.36624404335156298e-05 * SOLAR_MASS),
    new Body(1.53796971148509165e+01, -2.59193146099879641e+01, 1.79258772950371181e-01, 2.68067772490389322e-03 * DAYS, 1.62824170038242295e-03 * DAYS, -9.51592254519715870e-05 * DAYS, 5.15138902046611451e-05 * SOLAR_MASS),
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
}
