// N-body simulation (the Computer Language Benchmarks Game shape) in f64 mode:
// five bodies as a class with seven double fields, kept in an array, advanced
// N steps. Prints the system energy before and after; every language evaluates
// the same expressions in the same order, so the results agree bit for bit
// (the runner compares them numerically anyway). Compile with --number-mode f64.
class Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
  constructor(x: number, y: number, z: number, vx: number, vy: number, vz: number, mass: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.mass = mass;
  }
}

function advance(bodies: Body[], n: i32, dt: number): void {
  for (let i: i32 = 0; i < n; i++) {
    const bi = bodies[i];
    for (let j: i32 = i + 1; j < n; j++) {
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
  for (let i: i32 = 0; i < n; i++) {
    const b = bodies[i];
    b.x = b.x + dt * b.vx;
    b.y = b.y + dt * b.vy;
    b.z = b.z + dt * b.vz;
  }
}

function energy(bodies: Body[], n: i32): number {
  let e = 0;
  for (let i: i32 = 0; i < n; i++) {
    const bi = bodies[i];
    e = e + 0.5 * bi.mass * (bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz);
    for (let j: i32 = i + 1; j < n; j++) {
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
  const N: i32 = 20000000; // bench:n
  const PI = 3.141592653589793;
  const SOLAR_MASS = 4 * PI * PI;
  const DAYS = 365.24;
  const bodies: Body[] = [
    new Body(0, 0, 0, 0, 0, 0, SOLAR_MASS),
    new Body(4.8414314424647209, -1.16032004402742839, -0.103622044471123109, 0.00166007664274403694 * DAYS, 0.00769901118419740425 * DAYS, -0.0000690460016972063023 * DAYS, 0.000954791938424326609 * SOLAR_MASS),
    new Body(8.34336671824457987, 4.12479856412430479, -0.403523417114321381, -0.00276742510726862411 * DAYS, 0.00499852801234917238 * DAYS, 0.0000230417297573763929 * DAYS, 0.000285885980666130812 * SOLAR_MASS),
    new Body(12.894369562139131, -15.1111514016986312, -0.223307578892655734, 0.00296460137564761618 * DAYS, 0.0023784717395948095 * DAYS, -0.0000296589568540237556 * DAYS, 0.0000436624404335156298 * SOLAR_MASS),
    new Body(15.3796971148509165, -25.9193146099879641, 0.179258772950371181, 0.00268067772490389322 * DAYS, 0.00162824170038242295 * DAYS, -0.000095159225451971587 * DAYS, 0.0000515138902046611451 * SOLAR_MASS),
  ];
  const n: i32 = 5;
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i: i32 = 0; i < n; i++) {
    px = px + bodies[i].vx * bodies[i].mass;
    py = py + bodies[i].vy * bodies[i].mass;
    pz = pz + bodies[i].vz * bodies[i].mass;
  }
  bodies[0].vx = -px / SOLAR_MASS;
  bodies[0].vy = -py / SOLAR_MASS;
  bodies[0].vz = -pz / SOLAR_MASS;
  console.log(energy(bodies, n));
  for (let k: i32 = 0; k < N; k++) {
    advance(bodies, n, 0.01);
  }
  console.log(energy(bodies, n));
  return 0;
}
