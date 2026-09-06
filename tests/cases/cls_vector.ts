class Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  dot(o: Vec3): number {
    return this.x * o.x + this.y * o.y + this.z * o.z;
  }

  scaled(k: number): Vec3 {
    return new Vec3(this.x * k, this.y * k, this.z * k);
  }

  addInPlace(o: Vec3): void {
    this.x += o.x;
    this.y += o.y;
    this.z += o.z;
  }
}

function centroid(count: number): Vec3 {
  const acc = new Vec3(0, 0, 0);
  for (let i = 0; i < count; i++) {
    acc.addInPlace(new Vec3(1, 2, 3).scaled(0.5));
  }
  return acc;
}

// `main(): void` because under --number-mode f64 the literal `0` is a double.
export function main(): void {
  const c = centroid(4);
  console.log(c.x);
  console.log(c.y);
  console.log(c.z);
  console.log(c.dot(new Vec3(1, 1, 1)));
}
