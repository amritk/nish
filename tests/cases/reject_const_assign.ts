// A module constant has no storage, so there is nothing to assign to.
const LIMIT: i32 = 10;

export function test(): number {
  LIMIT = 11;
  return LIMIT;
}
