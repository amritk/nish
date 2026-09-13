// A nullable is narrowed before it is called through.
export class Point {
  x: number = 0;
  scale(): number {
    return this.x;
  }
}

export const run = (p: Point | null): number => p.scale();
