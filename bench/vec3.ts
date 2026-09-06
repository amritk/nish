// Struct-heavy loop (f64 mode): a Vec3 class with methods, called N times in
// a tight loop that integrates a point under a constant force with a small
// perpendicular kick. Every method mutates in place or returns a number, so
// the loop allocates nothing (the arena would otherwise grow by 24 bytes per
// temporary; escape-analysed stack allocation of such temporaries is WP6).
// Prints the final position and the accumulated "energy"; all languages use
// the same expression order so the doubles agree bit for bit.
// Compile with --number-mode f64.
class Vec3 {
  x: number;
  y: number;
  z: number;
  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  add(o: Vec3): void {
    this.x = this.x + o.x;
    this.y = this.y + o.y;
    this.z = this.z + o.z;
  }
  addScaled(o: Vec3, s: number): void {
    this.x = this.x + o.x * s;
    this.y = this.y + o.y * s;
    this.z = this.z + o.z * s;
  }
  scale(s: number): void {
    this.x = this.x * s;
    this.y = this.y * s;
    this.z = this.z * s;
  }
  dot(o: Vec3): number {
    return this.x * o.x + this.y * o.y + this.z * o.z;
  }
  crossInto(o: Vec3, out: Vec3): void {
    out.x = this.y * o.z - this.z * o.y;
    out.y = this.z * o.x - this.x * o.z;
    out.z = this.x * o.y - this.y * o.x;
  }
  norm(): number {
    return Math.sqrt(this.dot(this));
  }
}

export function main(): i32 {
  const N: i32 = 50000000; // bench:n
  const DT = 0.0000001;
  const p = new Vec3(0, 0, 0);
  const v = new Vec3(1, 2, 3);
  const g = new Vec3(0, -0.0000001, 0);
  const kick = new Vec3(0, 0, 0);
  let energy = 0;
  for (let i: i32 = 0; i < N; i++) {
    v.add(g);
    v.crossInto(g, kick);
    v.addScaled(kick, 0.001);
    p.addScaled(v, DT);
    energy = energy + 0.5 * v.dot(v) + p.norm() * DT;
  }
  console.log(p.x);
  console.log(p.y);
  console.log(p.z);
  console.log(energy);
  return 0;
}
