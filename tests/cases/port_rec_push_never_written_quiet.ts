// WP33 NL8003, the quiet side: a copy into an array of records is only
// reported once one copy is written and the other read afterwards. Nothing
// below is: a record never written after its copy, a fresh record built on each
// pass of a loop, a write whose other copy is never read again, a write into a
// record a field points to (a pointer in both readings), and an array of a
// class, which holds pointers rather than copies.
interface Point {
  x: i32;
  y: i32;
}

interface Segment {
  from: Point;
  length: i32;
}

class Box {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

export const main = (): number => {
  const ps: Point[] = [];
  const p: Point = { x: 1, y: 2 };
  ps.push(p);
  console.log(ps[0].x + p.x);

  const out: Point[] = [];
  for (let i = 0; i < 3; i = i + 1) {
    const c: Point = { x: i, y: 0 };
    c.y = i * 2;
    out.push(c);
  }
  console.log(out[2].y);

  const kept: Point[] = [{ x: 0, y: 0 }];
  const last: Point = { x: 5, y: 5 };
  kept[0] = last;
  console.log(kept[0].x);
  last.x = 6;
  console.log(last.x);

  const segs: Segment[] = [];
  const s: Segment = { from: { x: 1, y: 1 }, length: 2 };
  segs.push(s);
  s.from.x = 7;
  console.log(segs[0].from.x);

  const boxes: Box[] = [];
  const b = new Box(1);
  boxes.push(b);
  b.v = 3;
  console.log(boxes[0].v);
  return 0;
};
