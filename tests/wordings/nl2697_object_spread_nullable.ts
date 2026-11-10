// NL2697: Spreading `null` copies no field under Node, so a maybe-null source is
// narrowed first.
interface Point {
  x: i32;
}

class Holder {
  point: Point | null = null;
}

export const main = (): i32 => {
  const h = new Holder();
  const p: Point = { ...h.point };
  return p.x;
};
