// NL2706: Node carries every field of the source onto the object, so a source field
// the target does not declare is refused rather than dropped.
interface Point {
  x: i32;
}

interface Point3 {
  x: i32;
  z: i32;
}

export const main = (): i32 => {
  const a: Point3 = { x: 1, z: 2 };
  const p: Point = { ...a };
  return p.x;
};
