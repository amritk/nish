// WP9 x WP6: the call-site reclaim belongs to the arena layer (wp6-memory.md
// §2), not the stack layer (§1), so `--no-stack-alloc` does not touch it. The
// `Point` below moves into the arena under the flag — that is what the flag is
// for — while the mark/keep bracket around `render` stays exactly where it is,
// because the proof it rests on (`allocEscapes`) is about what leaves the
// callee's frame and says nothing about where an allocation lives.
class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

function render(p: Point): string {
  return `(${p.x},${p.y})`;
}

export function main(): number {
  const p = new Point(3, 4);
  console.log(render(p));
  return 0;
}
