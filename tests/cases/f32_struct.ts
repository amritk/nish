// A struct of `f32` is half the footprint of one of `f64`: three floats and a
// count pack into 16 bytes where three doubles alone would need 24. Run
// natively so the field offsets and the arithmetic are both proved.
class Vec3 {
  x: f32 = 0.0;
  y: f32 = 0.0;
  z: f32 = 0.0;
  hits: u32 = 0;
}

function dot(a: Vec3, b: Vec3): f32 {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function test(): number {
  const v = new Vec3();
  v.x = 0.1;
  v.y = 0.25;
  v.z = 2.0;
  v.hits += 1;
  const w = new Vec3();
  w.x = 3.0;
  w.y = 4.0;
  w.z = 0.5;
  console.log(`${dot(v, w)} ${v.hits}`);
  const xs: Float32Array = new Float32Array(2);
  xs[0] = 0.1;
  xs[1] = xs[0] * 3.0;
  console.log(`${xs[0]} ${xs[1]} ${xs.length}`);
  return 0;
}
