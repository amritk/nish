// A parameter binds one name, so the ABI can name it.
export interface Point {
  x: number;
}

export const run = ({ x }: Point): number => x;
